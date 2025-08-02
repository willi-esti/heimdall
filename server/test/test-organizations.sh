#!/bin/bash

# Organizations API Test Suite
# Tests all organization endpoints with various scenarios

# Load utilities and configuration
source "$(dirname "$0")/test-utils.sh" "$@"

print_section_header "ORGANIZATIONS API TESTS"

# Get admin token (should be created by auth tests)
if [ -f "/tmp/admin_token" ]; then
    ADMIN_TOKEN=$(cat /tmp/admin_token)
    print_info "Using existing admin token for tests"
else
    print_warning "Admin token not found. Attempting to create admin user..."
    
    # Try to create admin user from config
    ADMIN_USER_DATA=$(get_user_data "admin" 2>/dev/null)
    if [ -z "$ADMIN_USER_DATA" ]; then
        # Fallback to fixed admin data
        ADMIN_USER_DATA='{"email":"admin@gmail.com","username":"admin","password":"admin","firstName":"Admin","lastName":"User"}'
    fi
    
    # Try to register admin user
    ADMIN_RESPONSE=$(execute_curl "curl -s -X POST '$BASE_URL/auth/register' -H 'Content-Type: application/json' -d '$ADMIN_USER_DATA'" "Register admin user" 2>/dev/null)
    
    if echo "$ADMIN_RESPONSE" | jq -e '.token' > /dev/null 2>&1; then
        ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r '.token')
        echo "$ADMIN_TOKEN" > /tmp/admin_token
        print_success "Admin user created and logged in"
    else
        # Try to login if user already exists
        ADMIN_LOGIN_DATA='{"identifier":"admin@gmail.com","password":"admin"}'
        ADMIN_LOGIN_RESPONSE=$(execute_curl "curl -s -X POST '$BASE_URL/auth/login' -H 'Content-Type: application/json' -d '$ADMIN_LOGIN_DATA'" "Login admin user" 2>/dev/null)
        
        if echo "$ADMIN_LOGIN_RESPONSE" | jq -e '.token' > /dev/null 2>&1; then
            ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESPONSE" | jq -r '.token')
            echo "$ADMIN_TOKEN" > /tmp/admin_token
            print_success "Admin user logged in successfully"
        else
            print_error "Could not create or login admin user. Please run auth tests first."
            exit 1
        fi
    fi
fi

# Create test users for organization membership tests
print_info "Setting up test users (will reuse if they exist)..."
ORG_USER1_DATA=$(get_user_data "orgTest1")
ORG_USER2_DATA=$(get_user_data "orgTest2")
VIEW_USER_DATA=$(get_user_data "viewUser")

# Register users (they may already exist from previous test runs)
USER1_TOKEN=$(register_and_login_from_data "$ORG_USER1_DATA")
if [ -n "$USER1_TOKEN" ]; then
    print_success "User 1 (orgTest1) ready for testing"
else
    print_warning "User 1 setup failed, but continuing tests"
fi

USER2_TOKEN=$(register_and_login_from_data "$ORG_USER2_DATA")
if [ -n "$USER2_TOKEN" ]; then
    print_success "User 2 (orgTest2) ready for testing"
else
    print_warning "User 2 setup failed, but continuing tests"
fi
VIEW_USER_TOKEN=$(register_and_login_from_data "$VIEW_USER_DATA")

# Test 1: Create Organization - Valid Data
print_test_header "Create Organization - Valid Data"
ORG_DATA=$(get_org_data "valid")
RESPONSE=$(execute_curl "curl -s -X POST '$BASE_URL/organizations' -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '$ORG_DATA'" "Create organization")

ORG_ID=$(echo "$RESPONSE" | jq -r '.organization.id')
if [ "$ORG_ID" != "null" ]; then
    print_success "Organization created successfully: $ORG_ID"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Failed to create organization"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))
pause_if_enabled

# Test 2: Create Organization - Duplicate Name (409)
print_test_header "Create Organization - Duplicate Name"
DUPLICATE_ORG_DATA=$(get_org_data "duplicate")
make_request "POST" "/organizations" "$DUPLICATE_ORG_DATA" "409" "$ADMIN_TOKEN" "Duplicate organization name"

# Test 3: Create Organization - No Token (401)
print_test_header "Create Organization - No Token"
VALID_ORG_DATA=$(get_org_data "secondary")
make_request "POST" "/organizations" "$VALID_ORG_DATA" "401" "" "Create organization without token"

# Test 4: Create Organization - Missing Name (400)
print_test_header "Create Organization - Missing Name"
INVALID_ORG_DATA=$(get_org_data "missingName")
make_request "POST" "/organizations" "$INVALID_ORG_DATA" "400" "$ADMIN_TOKEN" "Missing organization name"

# Test 5: Create Organization - Empty Name (400)
print_test_header "Create Organization - Empty Name"
EMPTY_NAME_DATA='{"name": "", "description": "Organization with empty name"}'
make_request "POST" "/organizations" "$EMPTY_NAME_DATA" "400" "$ADMIN_TOKEN" "Empty organization name"

# Test 6: Get User Organizations
print_test_header "Get User Organizations"
make_request "GET" "/organizations" "" "200" "$ADMIN_TOKEN" "Get user organizations"

# Test 7: Get User Organizations - No Token (401)
print_test_header "Get User Organizations - No Token"
make_request "GET" "/organizations" "" "401" "" "Get organizations without token"

# Test 8: Get Organization by ID
print_test_header "Get Organization by ID"
make_request "GET" "/organizations/$ORG_ID" "" "200" "$ADMIN_TOKEN" "Get organization by ID"

# Test 9: Get Organization by ID - Non-existent (404)
print_test_header "Get Organization by ID - Non-existent"
make_request "GET" "/organizations/non-existent-id" "" "404" "$ADMIN_TOKEN" "Non-existent organization"

# Test 10: Get Organization by ID - No Access (403)
print_test_header "Get Organization by ID - No Access"
make_request "GET" "/organizations/$ORG_ID" "" "403" "$USER1_TOKEN" "No access to organization"

# Test 11: Add Member to Organization - Valid Data (201)
print_test_header "Add Member to Organization - Valid Data"
ADD_MEMBER_DATA=$(get_user_data "orgTest1" | jq '. | {email: .email, role: "VIEW"}')
make_request "POST" "/organizations/$ORG_ID/members" "$ADD_MEMBER_DATA" "201" "$ADMIN_TOKEN" "Add member to organization"

# Test 12: Add Member to Organization - Non-existent User (404)
print_test_header "Add Member to Organization - Non-existent User"
NONEXISTENT_MEMBER_DATA='{"email": "nonexistent@example.com", "role": "VIEW"}'
make_request "POST" "/organizations/$ORG_ID/members" "$NONEXISTENT_MEMBER_DATA" "404" "$ADMIN_TOKEN" "Add non-existent user"

# Test 13: Add Member to Organization - Already Member (409)
print_test_header "Add Member to Organization - Already Member"
make_request "POST" "/organizations/$ORG_ID/members" "$ADD_MEMBER_DATA" "409" "$ADMIN_TOKEN" "Add existing member"

# Test 14: Add Member to Organization - Not Admin (403)
print_test_header "Add Member to Organization - Not Admin"
ADD_MEMBER_DATA2=$(get_user_data "orgTest2" | jq '. | {email: .email, role: "VIEW"}')
make_request "POST" "/organizations/$ORG_ID/members" "$ADD_MEMBER_DATA2" "403" "$USER1_TOKEN" "Add member without admin rights"

# Test 15: Add Member to Organization - Invalid Role (400)
print_test_header "Add Member to Organization - Invalid Role"
INVALID_ROLE_DATA=$(get_user_data "orgTest2" | jq '. | {email: .email, role: "INVALID_ROLE"}')
make_request "POST" "/organizations/$ORG_ID/members" "$INVALID_ROLE_DATA" "400" "$ADMIN_TOKEN" "Invalid role"

# Test 12: Add Member to Organization - Non-existent User (404)
print_test_header "Add Member to Organization - Non-existent User"
NONEXISTENT_MEMBER_DATA='{
  "email": "nonexistent@example.com",
  "role": "VIEW"
}'
make_request "POST" "/organizations/$ORG_ID/members" "$NONEXISTENT_MEMBER_DATA" "404" "$ADMIN_TOKEN" "Add non-existent user"

# Test 13: Add Member to Organization - Already Member (409)
print_test_header "Add Member to Organization - Already Member"
make_request "POST" "/organizations/$ORG_ID/members" "$ADD_MEMBER_DATA" "409" "$ADMIN_TOKEN" "Add existing member"

# Test 14: Add Member to Organization - Not Admin (403)
print_test_header "Add Member to Organization - Not Admin"
ADD_MEMBER_DATA2='{
  "email": "orgtest2@example.com",
  "role": "VIEW"
}'
make_request "POST" "/organizations/$ORG_ID/members" "$ADD_MEMBER_DATA2" "403" "$USER1_TOKEN" "Add member without admin rights"

# Test 15: Add Member to Organization - Invalid Role (400)
print_test_header "Add Member to Organization - Invalid Role"
INVALID_ROLE_DATA='{
  "email": "orgtest2@example.com",
  "role": "INVALID_ROLE"
}'
make_request "POST" "/organizations/$ORG_ID/members" "$INVALID_ROLE_DATA" "400" "$ADMIN_TOKEN" "Invalid role"

# Add second member as VIEW user for next tests
print_info "Adding second member for role tests..."
execute_curl "curl -s -X POST '$BASE_URL/organizations/$ORG_ID/members' -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '$ADD_MEMBER_DATA2'" "Add second member" > /dev/null
pause_if_enabled

# Get USER1 and USER2 IDs for member management tests
USER1_ID=$(execute_curl "curl -s -X GET '$BASE_URL/auth/me' -H 'Authorization: Bearer $USER1_TOKEN'" "Get USER1 ID" | jq -r '.user.id')
USER2_ID=$(execute_curl "curl -s -X GET '$BASE_URL/auth/me' -H 'Authorization: Bearer $USER2_TOKEN'" "Get USER2 ID" | jq -r '.user.id')

# Test 16: Update Member Role - Valid Data
print_test_header "Update Member Role - Valid Data"
UPDATE_ROLE_DATA='{
  "role": "ADMIN"
}'
make_request "PUT" "/organizations/$ORG_ID/members/$USER1_ID" "$UPDATE_ROLE_DATA" "200" "$ADMIN_TOKEN" "Update member role"

# Test 17: Update Member Role - Not Admin (403)
print_test_header "Update Member Role - Not Admin"
make_request "PUT" "/organizations/$ORG_ID/members/$USER2_ID" "$UPDATE_ROLE_DATA" "403" "$USER2_TOKEN" "Update role without admin rights"

# Test 18: Update Member Role - Non-existent Member (404)
print_test_header "Update Member Role - Non-existent Member"
make_request "PUT" "/organizations/$ORG_ID/members/non-existent-id" "$UPDATE_ROLE_DATA" "404" "$ADMIN_TOKEN" "Update non-existent member"

# Test 19: Update Member Role - Invalid Role (400)
print_test_header "Update Member Role - Invalid Role"
INVALID_UPDATE_ROLE_DATA='{
  "role": "INVALID_ROLE"
}'
make_request "PUT" "/organizations/$ORG_ID/members/$USER2_ID" "$INVALID_UPDATE_ROLE_DATA" "400" "$ADMIN_TOKEN" "Invalid role in update"

# Test 20: Remove Member from Organization
print_test_header "Remove Member from Organization"
make_request "DELETE" "/organizations/$ORG_ID/members/$USER2_ID" "" "200" "$ADMIN_TOKEN" "Remove member from organization"

# Test 21: Remove Member - Not Admin (403)
print_test_header "Remove Member - Not Admin"
make_request "DELETE" "/organizations/$ORG_ID/members/$USER1_ID" "" "403" "$USER2_TOKEN" "Remove member without admin rights"

# Test 22: Remove Member - Non-existent Member (404)
print_test_header "Remove Member - Non-existent Member"
make_request "DELETE" "/organizations/$ORG_ID/members/non-existent-id" "" "404" "$ADMIN_TOKEN" "Remove non-existent member"

# Test 23: Remove Last Admin (400)
print_test_header "Remove Last Admin - Should Fail"
ADMIN_ID=$(execute_curl "curl -s -X GET '$BASE_URL/auth/me' -H 'Authorization: Bearer $ADMIN_TOKEN'" "Get admin ID" | jq -r '.user.id')
make_request "DELETE" "/organizations/$ORG_ID/members/$ADMIN_ID" "" "400" "$USER1_TOKEN" "Remove last admin"

# Test 24: Organization Deletion Request
print_test_header "Organization Deletion Request"
DELETION_REQUEST_DATA='{
  "reason": "Test deletion request"
}'
make_request "POST" "/organizations/$ORG_ID/deletion/request" "$DELETION_REQUEST_DATA" "201" "$ADMIN_TOKEN" "Request organization deletion"

# Test 25: Organization Deletion Request - Not Admin (403)
print_test_header "Organization Deletion Request - Not Admin"
make_request "POST" "/organizations/$ORG_ID/deletion/request" "$DELETION_REQUEST_DATA" "403" "$USER2_TOKEN" "Request deletion without admin rights"

# Test 26: Organization Deletion Request - Already Pending (409)
print_test_header "Organization Deletion Request - Already Pending"
make_request "POST" "/organizations/$ORG_ID/deletion/request" "$DELETION_REQUEST_DATA" "409" "$ADMIN_TOKEN" "Duplicate deletion request"

# Test 27: Get Deletion Requests
print_test_header "Get Deletion Requests"
make_request "GET" "/organizations/$ORG_ID/deletion/requests" "" "200" "$ADMIN_TOKEN" "Get deletion requests"

# Test 28: Get Deletion Requests - Not Admin (403)
print_test_header "Get Deletion Requests - Not Admin"
make_request "GET" "/organizations/$ORG_ID/deletion/requests" "" "403" "$USER2_TOKEN" "Get deletion requests without admin rights"

# Test 29: Reject Organization Deletion
print_test_header "Reject Organization Deletion"
make_request "POST" "/organizations/$ORG_ID/deletion/reject" "" "200" "$USER1_TOKEN" "Reject organization deletion"

# Test 30: Reject Organization Deletion - Not Admin (403)
print_test_header "Reject Organization Deletion - Not Admin"
make_request "POST" "/organizations/$ORG_ID/deletion/reject" "" "403" "$USER2_TOKEN" "Reject deletion without admin rights"

# Test 31: Request Deletion Again for Approval Test
print_test_header "Request Deletion Again"
make_request "POST" "/organizations/$ORG_ID/deletion/request" "$DELETION_REQUEST_DATA" "201" "$ADMIN_TOKEN" "Request deletion again"

# Test 32: Approve Organization Deletion
print_test_header "Approve Organization Deletion"
make_request "POST" "/organizations/$ORG_ID/deletion/approve" "" "200" "$USER1_TOKEN" "Approve organization deletion"

# Test 33: Access Deleted Organization (403)
print_test_header "Access Deleted Organization"
make_request "GET" "/organizations/$ORG_ID" "" "403" "$ADMIN_TOKEN" "Access deleted organization"

# Store organization ID for other tests
echo "$ORG_ID" > /tmp/test_org_id

print_info "Organization tests completed. Organization ID: $ORG_ID"

# Generate test report
generate_test_report
