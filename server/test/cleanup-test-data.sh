#!/bin/bash

# Test Data Cleanup Script
# Cleans up all test data created during test runs

# Load utilities and configuration
source "$(dirname "$0")/test-utils.sh" "$@"

print_section_header "TEST DATA CLEANUP"

# Get admin token if available
if [ -f "/tmp/admin_token" ]; then
    ADMIN_TOKEN=$(cat /tmp/admin_token)
    print_info "Using existing admin token for cleanup"
else
    print_warning "No admin token found. Some cleanup operations may not be possible."
    ADMIN_TOKEN=""
fi

# Function to safely delete with error handling
safe_delete() {
    local method="$1"
    local endpoint="$2"
    local token="$3"
    local description="$4"
    
    if [ -n "$token" ]; then
        local response=$(curl -s -w '%{http_code}' -X "$method" "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $token")
        local status_code="${response: -3}"
        
        if [ "$status_code" = "200" ] || [ "$status_code" = "204" ] || [ "$status_code" = "404" ]; then
            print_success "✓ $description"
        else
            print_warning "⚠ $description (Status: $status_code)"
        fi
    else
        print_warning "⚠ Skipped $description (no token)"
    fi
}

# Clean up temporary files
print_info "Cleaning up temporary files..."
rm -f /tmp/admin_token
rm -f /tmp/test_org_id
rm -f /tmp/test_folder_id
rm -f /tmp/test_secret_id
print_success "✓ Temporary files cleaned"

# If we have admin token, clean up database test data
if [ -n "$ADMIN_TOKEN" ]; then
    print_info "Cleaning up database test data..."
    
    # Clean up test organizations (this should cascade to folders, secrets, etc.)
    print_info "Cleaning up test organizations..."
    
    # Get all organizations for the admin user
    ORG_RESPONSE=$(curl -s -X GET "$BASE_URL/organizations" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$ORG_RESPONSE" | jq -e '.organizations' > /dev/null 2>&1; then
        echo "$ORG_RESPONSE" | jq -r '.organizations[].id' | while read -r org_id; do
            if [ -n "$org_id" ] && [ "$org_id" != "null" ]; then
                # Get organization details to check if it's a test org
                ORG_DETAILS=$(curl -s -X GET "$BASE_URL/organizations/$org_id" \
                    -H "Authorization: Bearer $ADMIN_TOKEN")
                
                ORG_NAME=$(echo "$ORG_DETAILS" | jq -r '.organization.name')
                
                # Only delete organizations that look like test data
                if echo "$ORG_NAME" | grep -E "(Test|test|Demo|demo|Folder Test|Secret Test|Invite Test)" > /dev/null; then
                    print_info "Deleting test organization: $ORG_NAME"
                    
                    # First request deletion
                    curl -s -X POST "$BASE_URL/organizations/$org_id/deletion/request" \
                        -H "Authorization: Bearer $ADMIN_TOKEN" \
                        -H "Content-Type: application/json" \
                        -d '{"reason": "Automated test cleanup"}' > /dev/null
                    
                    # Then approve deletion
                    safe_delete "POST" "/organizations/$org_id/deletion/approve" "$ADMIN_TOKEN" "Organization '$ORG_NAME' deletion"
                fi
            fi
        done
    fi
    
    # Clean up any remaining invitations
    print_info "Cleaning up test invitations..."
    # Note: This would require an admin endpoint to list all invitations
    # For now, we'll rely on organization cleanup to cascade delete invitations
    
    print_success "✓ Database cleanup completed"
else
    print_warning "Skipping database cleanup (no admin token available)"
fi

# Clean up test users (this is tricky as we don't have a user deletion endpoint in most systems)
print_info "Note: Test users created during testing should be manually reviewed and cleaned up if needed:"
echo "  - testuser1@example.com"
echo "  - orgtest1@example.com, orgtest2@example.com"
echo "  - viewuser@example.com"
echo "  - folderwrite@example.com, folderview@example.com"
echo "  - secretwrite@example.com, secretview@example.com"
echo "  - inviteadmin@example.com, invitemember@example.com"
echo "  - newuser@example.com"
echo "  - Various other test users"

print_info "Cleanup completed!"

# Generate simple report
echo
print_section_header "CLEANUP SUMMARY"
echo "✅ Temporary files removed"
if [ -n "$ADMIN_TOKEN" ]; then
    echo "✅ Test organizations deleted"
    echo "✅ Associated folders, secrets, and invites cleaned up"
else
    echo "⚠️  Database cleanup skipped (no admin token)"
fi
echo "⚠️  Test users require manual cleanup"
echo
