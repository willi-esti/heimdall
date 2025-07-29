#!/bin/bash

# Invites API Test Suite
# Tests organization invitation workflow

# Load utilities and configuration
source "$(dirname "$0")/test-utils.sh" "$@"

print_section_header "INVITES API TESTS"

# Get admin token and organization ID
if [ -f "/tmp/admin_token" ]; then
    ADMIN_TOKEN=$(cat /tmp/admin_token)
else
    print_error "Admin token not found. Please run auth tests first."
    exit 1
fi

# Create a fresh organization for invite tests
print_info "Setting up test organization for invites..."
ORG_RESPONSE=$(curl -s -X POST "$BASE_URL/organizations" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Invite Test Org", "description": "Organization for invite testing"}')

ORG_ID=$(echo "$ORG_RESPONSE" | jq -r '.organization.id')
if [ "$ORG_ID" = "null" ]; then
    print_error "Failed to create test organization for invites"
    exit 1
fi

# Create test users
USER_ADMIN_TOKEN=$(register_and_login "inviteadmin@example.com" "inviteadmin" "InviteAdmin123!" "Invite" "Admin")
USER_MEMBER_TOKEN=$(register_and_login "invitemember@example.com" "invitemember" "InviteMember123!" "Invite" "Member")

# Add admin user to organization
curl -s -X POST "$BASE_URL/organizations/$ORG_ID/members" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "inviteadmin@example.com", "role": "ADMIN"}' > /dev/null

# Test 1: Create Invitation - Valid Data
print_test_header "Create Invitation - Valid Data"
INVITE_DATA='{
  "email": "newuser@example.com",
  "role": "WRITE",
  "organizationId": "'$ORG_ID'"
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/invites" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$INVITE_DATA")

INVITE_ID=$(echo "$RESPONSE" | jq -r '.invite.id')
INVITE_TOKEN=$(echo "$RESPONSE" | jq -r '.invite.token')
if [ "$INVITE_ID" != "null" ]; then
    print_success "Invitation created successfully: $INVITE_ID"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Failed to create invitation"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test 2: Create Invitation - No Token (401)
print_test_header "Create Invitation - No Token"
make_request "POST" "/invites" "$INVITE_DATA" "401" "" "Create invitation without token"

# Test 3: Create Invitation - Missing Email (400)
print_test_header "Create Invitation - Missing Email"
INVALID_INVITE_DATA='{
  "role": "WRITE",
  "organizationId": "'$ORG_ID'"
}'
make_request "POST" "/invites" "$INVALID_INVITE_DATA" "400" "$ADMIN_TOKEN" "Missing email"

# Test 4: Create Invitation - Invalid Email (400)
print_test_header "Create Invitation - Invalid Email"
INVALID_EMAIL_INVITE='{
  "email": "invalid-email",
  "role": "WRITE",
  "organizationId": "'$ORG_ID'"
}'
make_request "POST" "/invites" "$INVALID_EMAIL_INVITE" "400" "$ADMIN_TOKEN" "Invalid email format"

# Test 5: Create Invitation - Missing Role (400)
print_test_header "Create Invitation - Missing Role"
NO_ROLE_INVITE='{
  "email": "norole@example.com",
  "organizationId": "'$ORG_ID'"
}'
make_request "POST" "/invites" "$NO_ROLE_INVITE" "400" "$ADMIN_TOKEN" "Missing role"

# Test 6: Create Invitation - Invalid Role (400)
print_test_header "Create Invitation - Invalid Role"
INVALID_ROLE_INVITE='{
  "email": "invalidrole@example.com",
  "role": "INVALID_ROLE",
  "organizationId": "'$ORG_ID'"
}'
make_request "POST" "/invites" "$INVALID_ROLE_INVITE" "400" "$ADMIN_TOKEN" "Invalid role"

# Test 7: Create Invitation - Missing Organization ID (400)
print_test_header "Create Invitation - Missing Organization ID"
NO_ORG_INVITE='{
  "email": "noorg@example.com",
  "role": "WRITE"
}'
make_request "POST" "/invites" "$NO_ORG_INVITE" "400" "$ADMIN_TOKEN" "Missing organization ID"

# Test 8: Create Invitation - Non-existent Organization (404)
print_test_header "Create Invitation - Non-existent Organization"
NONEXISTENT_ORG_INVITE='{
  "email": "nonexistentorg@example.com",
  "role": "WRITE",
  "organizationId": "non-existent-org-id"
}'
make_request "POST" "/invites" "$NONEXISTENT_ORG_INVITE" "404" "$ADMIN_TOKEN" "Non-existent organization"

# Test 9: Create Invitation - Already Member (409)
print_test_header "Create Invitation - Already Member"
ALREADY_MEMBER_INVITE='{
  "email": "inviteadmin@example.com",
  "role": "WRITE",
  "organizationId": "'$ORG_ID'"
}'
make_request "POST" "/invites" "$ALREADY_MEMBER_INVITE" "409" "$ADMIN_TOKEN" "Already organization member"

# Test 10: Create Invitation - Duplicate Pending (409)
print_test_header "Create Invitation - Duplicate Pending"
make_request "POST" "/invites" "$INVITE_DATA" "409" "$ADMIN_TOKEN" "Duplicate pending invitation"

# Test 11: Create Invitation - Non-Admin User (403)
print_test_header "Create Invitation - Non-Admin User"
MEMBER_INVITE_DATA='{
  "email": "memberinvite@example.com",
  "role": "VIEW",
  "organizationId": "'$ORG_ID'"
}'
make_request "POST" "/invites" "$MEMBER_INVITE_DATA" "403" "$USER_MEMBER_TOKEN" "Create invitation as non-admin"

# Test 12: Create Invitation - Org Admin (201)
print_test_header "Create Invitation - Org Admin"
ORG_ADMIN_INVITE='{
  "email": "orgadmininvite@example.com",
  "role": "WRITE",
  "organizationId": "'$ORG_ID'"
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/invites" \
  -H "Authorization: Bearer $USER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ORG_ADMIN_INVITE")

ORG_ADMIN_INVITE_ID=$(echo "$RESPONSE" | jq -r '.invite.id')
if [ "$ORG_ADMIN_INVITE_ID" != "null" ]; then
    print_success "Org admin invitation created successfully"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Failed to create invitation as org admin"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test 13: Get Invitation by ID
print_test_header "Get Invitation by ID"
make_request "GET" "/invites/$INVITE_ID" "" "200" "$ADMIN_TOKEN" "Get invitation by ID"

# Test 14: Get Invitation by ID - Non-existent (404)
print_test_header "Get Invitation by ID - Non-existent"
make_request "GET" "/invites/non-existent-invite-id" "" "404" "$ADMIN_TOKEN" "Non-existent invitation"

# Test 15: Get Invitation by ID - No Token (401)
print_test_header "Get Invitation by ID - No Token"
make_request "GET" "/invites/$INVITE_ID" "" "401" "" "Get invitation without token"

# Test 16: Get Invitation by Token - Valid
print_test_header "Get Invitation by Token - Valid"
make_request "GET" "/invites/token/$INVITE_TOKEN" "" "200" "" "Get invitation by token"

# Test 17: Get Invitation by Token - Invalid (404)
print_test_header "Get Invitation by Token - Invalid"
make_request "GET" "/invites/token/invalid-token" "" "404" "" "Invalid invitation token"

# Test 18: Get Organization Invitations
print_test_header "Get Organization Invitations"
make_request "GET" "/organizations/$ORG_ID/invites" "" "200" "$ADMIN_TOKEN" "Get organization invitations"

# Test 19: Get Organization Invitations - No Token (401)
print_test_header "Get Organization Invitations - No Token"
make_request "GET" "/organizations/$ORG_ID/invites" "" "401" "" "Get org invitations without token"

# Test 20: Get Organization Invitations - Non-Admin (403)
print_test_header "Get Organization Invitations - Non-Admin"
make_request "GET" "/organizations/$ORG_ID/invites" "" "403" "$USER_MEMBER_TOKEN" "Get org invitations as non-admin"

# Test 21: Update Invitation - Valid Data
print_test_header "Update Invitation - Valid Data"
UPDATE_INVITE_DATA='{
  "role": "VIEW"
}'
make_request "PUT" "/invites/$INVITE_ID" "$UPDATE_INVITE_DATA" "200" "$ADMIN_TOKEN" "Update invitation"

# Test 22: Update Invitation - No Token (401)
print_test_header "Update Invitation - No Token"
make_request "PUT" "/invites/$INVITE_ID" "$UPDATE_INVITE_DATA" "401" "" "Update invitation without token"

# Test 23: Update Invitation - Non-existent (404)
print_test_header "Update Invitation - Non-existent"
make_request "PUT" "/invites/non-existent-invite-id" "$UPDATE_INVITE_DATA" "404" "$ADMIN_TOKEN" "Update non-existent invitation"

# Test 24: Update Invitation - Invalid Role (400)
print_test_header "Update Invitation - Invalid Role"
INVALID_UPDATE_INVITE='{
  "role": "INVALID_ROLE"
}'
make_request "PUT" "/invites/$INVITE_ID" "$INVALID_UPDATE_INVITE" "400" "$ADMIN_TOKEN" "Update with invalid role"

# Test 25: Update Invitation - Non-Admin (403)
print_test_header "Update Invitation - Non-Admin"
make_request "PUT" "/invites/$INVITE_ID" "$UPDATE_INVITE_DATA" "403" "$USER_MEMBER_TOKEN" "Update invitation as non-admin"

# Test 26: Accept Invitation - Valid Token
print_test_header "Accept Invitation - Valid Token"
# First register the user who will accept the invitation
ACCEPT_USER_TOKEN=$(register_and_login "newuser@example.com" "newuser" "NewUser123!" "New" "User")

ACCEPT_DATA='{
  "token": "'$INVITE_TOKEN'"
}'
make_request "POST" "/invites/accept" "$ACCEPT_DATA" "200" "$ACCEPT_USER_TOKEN" "Accept invitation"

# Test 27: Accept Invitation - No Token (401)
print_test_header "Accept Invitation - No Token"
make_request "POST" "/invites/accept" "$ACCEPT_DATA" "401" "" "Accept invitation without token"

# Test 28: Accept Invitation - Invalid Token (404)
print_test_header "Accept Invitation - Invalid Token"
INVALID_ACCEPT_DATA='{
  "token": "invalid-token"
}'
make_request "POST" "/invites/accept" "$INVALID_ACCEPT_DATA" "404" "$ACCEPT_USER_TOKEN" "Accept with invalid token"

# Test 29: Accept Invitation - Already Accepted (409)
print_test_header "Accept Invitation - Already Accepted"
make_request "POST" "/invites/accept" "$ACCEPT_DATA" "409" "$ACCEPT_USER_TOKEN" "Accept already accepted invitation"

# Test 30: Resend Invitation
print_test_header "Resend Invitation"
make_request "POST" "/invites/$ORG_ADMIN_INVITE_ID/resend" "" "200" "$ADMIN_TOKEN" "Resend invitation"

# Test 31: Resend Invitation - No Token (401)
print_test_header "Resend Invitation - No Token"
make_request "POST" "/invites/$ORG_ADMIN_INVITE_ID/resend" "" "401" "" "Resend invitation without token"

# Test 32: Resend Invitation - Non-existent (404)
print_test_header "Resend Invitation - Non-existent"
make_request "POST" "/invites/non-existent-invite-id/resend" "" "404" "$ADMIN_TOKEN" "Resend non-existent invitation"

# Test 33: Resend Invitation - Non-Admin (403)
print_test_header "Resend Invitation - Non-Admin"
make_request "POST" "/invites/$ORG_ADMIN_INVITE_ID/resend" "" "403" "$USER_MEMBER_TOKEN" "Resend invitation as non-admin"

# Test 34: Cancel Invitation
print_test_header "Cancel Invitation"
make_request "DELETE" "/invites/$ORG_ADMIN_INVITE_ID" "" "200" "$ADMIN_TOKEN" "Cancel invitation"

# Test 35: Cancel Invitation - No Token (401)
print_test_header "Cancel Invitation - No Token"
make_request "DELETE" "/invites/$ORG_ADMIN_INVITE_ID" "" "401" "" "Cancel invitation without token"

# Test 36: Cancel Invitation - Non-existent (404)
print_test_header "Cancel Invitation - Non-existent"
make_request "DELETE" "/invites/non-existent-invite-id" "" "404" "$ADMIN_TOKEN" "Cancel non-existent invitation"

# Test 37: Cancel Invitation - Non-Admin (403)
print_test_header "Cancel Invitation - Non-Admin"
# Create another invitation to test cancellation permissions
CANCEL_TEST_INVITE='{
  "email": "canceltest@example.com",
  "role": "VIEW",
  "organizationId": "'$ORG_ID'"
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/invites" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CANCEL_TEST_INVITE")
CANCEL_INVITE_ID=$(echo "$RESPONSE" | jq -r '.invite.id')

make_request "DELETE" "/invites/$CANCEL_INVITE_ID" "" "403" "$USER_MEMBER_TOKEN" "Cancel invitation as non-admin"

# Test 38: Get User's Pending Invitations
print_test_header "Get User's Pending Invitations"
# Create invitation for current test user
USER_PENDING_INVITE='{
  "email": "invitemember@example.com",
  "role": "WRITE",
  "organizationId": "'$ORG_ID'"
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/invites" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$USER_PENDING_INVITE")

make_request "GET" "/invites/pending" "" "200" "$USER_MEMBER_TOKEN" "Get user's pending invitations"

# Test 39: Get User's Pending Invitations - No Token (401)
print_test_header "Get User's Pending Invitations - No Token"
make_request "GET" "/invites/pending" "" "401" "" "Get pending invitations without token"

print_info "Invite tests completed."

# Generate test report
generate_test_report
