#!/bin/bash

# Secrets API Test Suite
# Tests all secret endpoints including the new version deletion feature

# Load utilities and configuration
source "$(dirname "$0")/test-utils.sh" "$@"

print_section_header "SECRETS API TESTS"

# Get admin token and organization ID
if [ -f "/tmp/admin_token" ]; then
    ADMIN_TOKEN=$(cat /tmp/admin_token)
else
    print_error "Admin token not found. Please run auth tests first."
    exit 1
fi

# Create a fresh organization and folder for secret tests
print_info "Setting up test organization and folder for secrets..."
ORG_RESPONSE=$(curl -s -X POST "$BASE_URL/organizations" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Secret Test Org", "description": "Organization for secret testing"}')

ORG_ID=$(echo "$ORG_RESPONSE" | jq -r '.organization.id')
if [ "$ORG_ID" = "null" ]; then
    print_error "Failed to create test organization for secrets"
    exit 1
fi

FOLDER_RESPONSE=$(curl -s -X POST "$BASE_URL/folders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Secret Test Folder", "description": "Folder for secret testing", "organizationId": "'$ORG_ID'"}')

FOLDER_ID=$(echo "$FOLDER_RESPONSE" | jq -r '.folder.id')
if [ "$FOLDER_ID" = "null" ]; then
    print_error "Failed to create test folder for secrets"
    exit 1
fi

# Create test users with different permissions
USER_WRITE_TOKEN=$(register_and_login "secretwrite@example.com" "secretwrite" "SecretWrite123!" "Secret" "Writer")
USER_VIEW_TOKEN=$(register_and_login "secretview@example.com" "secretview" "SecretView123!" "Secret" "Viewer")

# Add users to organization with specific roles
curl -s -X POST "$BASE_URL/organizations/$ORG_ID/members" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "secretwrite@example.com", "role": "WRITE"}' > /dev/null

curl -s -X POST "$BASE_URL/organizations/$ORG_ID/members" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "secretview@example.com", "role": "VIEW"}' > /dev/null

# Test 1: Create Secret - Valid Data
print_test_header "Create Secret - Valid Data"
SECRET_DATA='{
  "name": "Test Secret",
  "description": "Secret for testing",
  "value": "secret_value_123",
  "folderId": "'$FOLDER_ID'"
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/secrets" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$SECRET_DATA")

SECRET_ID=$(echo "$RESPONSE" | jq -r '.secret.id')
if [ "$SECRET_ID" != "null" ]; then
    print_success "Secret created successfully: $SECRET_ID"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Failed to create secret"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test 2: Create Secret - No Token (401)
print_test_header "Create Secret - No Token"
make_request "POST" "/secrets" "$SECRET_DATA" "401" "" "Create secret without token"

# Test 3: Create Secret - Missing Name (400)
print_test_header "Create Secret - Missing Name"
INVALID_SECRET_DATA='{
  "description": "Secret without name",
  "value": "secret_value_123",
  "folderId": "'$FOLDER_ID'"
}'
make_request "POST" "/secrets" "$INVALID_SECRET_DATA" "400" "$ADMIN_TOKEN" "Missing secret name"

# Test 4: Create Secret - Missing Value (400)
print_test_header "Create Secret - Missing Value"
NO_VALUE_SECRET_DATA='{
  "name": "No Value Secret",
  "description": "Secret without value",
  "folderId": "'$FOLDER_ID'"
}'
make_request "POST" "/secrets" "$NO_VALUE_SECRET_DATA" "400" "$ADMIN_TOKEN" "Missing secret value"

# Test 5: Create Secret - Non-existent Folder (404)
print_test_header "Create Secret - Non-existent Folder"
NONEXISTENT_FOLDER_SECRET_DATA='{
  "name": "Test Secret",
  "description": "Secret in non-existent folder",
  "value": "secret_value_123",
  "folderId": "non-existent-folder-id"
}'
make_request "POST" "/secrets" "$NONEXISTENT_FOLDER_SECRET_DATA" "404" "$ADMIN_TOKEN" "Non-existent folder"

# Test 6: Create Secret - Duplicate Name (409)
print_test_header "Create Secret - Duplicate Name"
make_request "POST" "/secrets" "$SECRET_DATA" "409" "$ADMIN_TOKEN" "Duplicate secret name"

# Test 7: Create Secret - VIEW User (403)
print_test_header "Create Secret - VIEW User"
VIEW_SECRET_DATA='{
  "name": "View User Secret",
  "description": "Secret by view user",
  "value": "secret_value_view",
  "folderId": "'$FOLDER_ID'"
}'
make_request "POST" "/secrets" "$VIEW_SECRET_DATA" "403" "$USER_VIEW_TOKEN" "Create secret with VIEW role"

# Test 8: Create Secret - WRITE User (201)
print_test_header "Create Secret - WRITE User"
WRITE_SECRET_DATA='{
  "name": "Write User Secret",
  "description": "Secret by write user",
  "value": "secret_value_write",
  "folderId": "'$FOLDER_ID'"
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/secrets" \
  -H "Authorization: Bearer $USER_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$WRITE_SECRET_DATA")

WRITE_SECRET_ID=$(echo "$RESPONSE" | jq -r '.secret.id')
if [ "$WRITE_SECRET_ID" != "null" ]; then
    print_success "WRITE user secret created successfully"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Failed to create secret with WRITE user"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test 9: Get Secret by ID
print_test_header "Get Secret by ID"
make_request "GET" "/secrets/$SECRET_ID" "" "200" "$ADMIN_TOKEN" "Get secret by ID"

# Test 10: Get Secret by ID - Non-existent (404)
print_test_header "Get Secret by ID - Non-existent"
make_request "GET" "/secrets/non-existent-secret-id" "" "404" "$ADMIN_TOKEN" "Non-existent secret"

# Test 11: Get Secret by ID - No Token (401)
print_test_header "Get Secret by ID - No Token"
make_request "GET" "/secrets/$SECRET_ID" "" "401" "" "Get secret without token"

# Test 12: Get Secret by ID - VIEW User (200)
print_test_header "Get Secret by ID - VIEW User"
make_request "GET" "/secrets/$SECRET_ID" "" "200" "$USER_VIEW_TOKEN" "Get secret with VIEW role"

# Test 13: Update Secret - Valid Data
print_test_header "Update Secret - Valid Data"
UPDATE_SECRET_DATA='{
  "name": "Updated Test Secret",
  "description": "Updated description for test secret",
  "value": "updated_secret_value_123"
}'
RESPONSE=$(curl -s -X PUT "$BASE_URL/secrets/$SECRET_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_SECRET_DATA")

VERSION_2=$(echo "$RESPONSE" | jq -r '.secret.currentVersion')
if [ "$VERSION_2" != "null" ]; then
    print_success "Secret updated successfully, new version: $VERSION_2"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Failed to update secret"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test 14: Update Secret - No Token (401)
print_test_header "Update Secret - No Token"
make_request "PUT" "/secrets/$SECRET_ID" "$UPDATE_SECRET_DATA" "401" "" "Update secret without token"

# Test 15: Update Secret - VIEW User (403)
print_test_header "Update Secret - VIEW User"
make_request "PUT" "/secrets/$SECRET_ID" "$UPDATE_SECRET_DATA" "403" "$USER_VIEW_TOKEN" "Update secret with VIEW role"

# Test 16: Update Secret - WRITE User (200)
print_test_header "Update Secret - WRITE User"
make_request "PUT" "/secrets/$WRITE_SECRET_ID" "$UPDATE_SECRET_DATA" "200" "$USER_WRITE_TOKEN" "Update secret with WRITE role"

# Test 17: Update Secret - Non-existent (404)
print_test_header "Update Secret - Non-existent"
make_request "PUT" "/secrets/non-existent-secret-id" "$UPDATE_SECRET_DATA" "404" "$ADMIN_TOKEN" "Update non-existent secret"

# Create another version to test version deletion
print_info "Creating additional versions for version deletion tests..."
UPDATE_SECRET_DATA_V3='{
  "name": "Updated Test Secret V3",
  "description": "Third version for testing",
  "value": "secret_value_v3"
}'
RESPONSE=$(curl -s -X PUT "$BASE_URL/secrets/$SECRET_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_SECRET_DATA_V3")
VERSION_3=$(echo "$RESPONSE" | jq -r '.secret.currentVersion')

# Test 18: Get Secret Versions
print_test_header "Get Secret Versions"
make_request "GET" "/secrets/$SECRET_ID/versions" "" "200" "$ADMIN_TOKEN" "Get secret versions"

# Test 19: Get Secret Version by Number
print_test_header "Get Secret Version by Number"
make_request "GET" "/secrets/$SECRET_ID/versions/1" "" "200" "$ADMIN_TOKEN" "Get version 1"

# Test 20: Get Secret Version - Non-existent Version (404)
print_test_header "Get Secret Version - Non-existent Version"
make_request "GET" "/secrets/$SECRET_ID/versions/999" "" "404" "$ADMIN_TOKEN" "Non-existent version"

# Test 21: Get Secret Version - No Token (401)
print_test_header "Get Secret Version - No Token"
make_request "GET" "/secrets/$SECRET_ID/versions/1" "" "401" "" "Get version without token"

# Test 22: Delete Secret Version - Valid Version (200)
print_test_header "Delete Secret Version - Valid Version"
make_request "DELETE" "/secrets/$SECRET_ID/versions/1" "" "200" "$ADMIN_TOKEN" "Delete version 1"

# Test 23: Delete Secret Version - Current Version (400)
print_test_header "Delete Secret Version - Current Version"
make_request "DELETE" "/secrets/$SECRET_ID/versions/$VERSION_3" "" "400" "$ADMIN_TOKEN" "Delete current version"

# Test 24: Delete Secret Version - Last Remaining Version (400)
print_test_header "Delete Secret Version - Last Remaining Version"
# First delete version 2 to leave only version 3
curl -s -X DELETE "$BASE_URL/secrets/$SECRET_ID/versions/$VERSION_2" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
make_request "DELETE" "/secrets/$SECRET_ID/versions/$VERSION_3" "" "400" "$ADMIN_TOKEN" "Delete last version"

# Test 25: Delete Secret Version - Non-existent Secret (404)
print_test_header "Delete Secret Version - Non-existent Secret"
make_request "DELETE" "/secrets/non-existent-secret-id/versions/1" "" "404" "$ADMIN_TOKEN" "Non-existent secret"

# Test 26: Delete Secret Version - Non-existent Version (404)
print_test_header "Delete Secret Version - Non-existent Version"
make_request "DELETE" "/secrets/$SECRET_ID/versions/999" "" "404" "$ADMIN_TOKEN" "Non-existent version"

# Test 27: Delete Secret Version - No Token (401)
print_test_header "Delete Secret Version - No Token"
make_request "DELETE" "/secrets/$SECRET_ID/versions/1" "" "401" "" "Delete version without token"

# Test 28: Delete Secret Version - VIEW User (403)
print_test_header "Delete Secret Version - VIEW User"
make_request "DELETE" "/secrets/$SECRET_ID/versions/1" "" "403" "$USER_VIEW_TOKEN" "Delete version with VIEW role"

# Test 29: Delete Secret Version - WRITE User (200)
print_test_header "Delete Secret Version - WRITE User"
# Create a secret with multiple versions for WRITE user
MULTI_VERSION_SECRET='{
  "name": "Multi Version Secret",
  "description": "Secret with multiple versions",
  "value": "version_1_value",
  "folderId": "'$FOLDER_ID'"
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/secrets" \
  -H "Authorization: Bearer $USER_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$MULTI_VERSION_SECRET")
MULTI_SECRET_ID=$(echo "$RESPONSE" | jq -r '.secret.id')

# Create version 2
curl -s -X PUT "$BASE_URL/secrets/$MULTI_SECRET_ID" \
  -H "Authorization: Bearer $USER_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Multi Version Secret", "description": "Second version", "value": "version_2_value"}' > /dev/null

make_request "DELETE" "/secrets/$MULTI_SECRET_ID/versions/1" "" "200" "$USER_WRITE_TOKEN" "Delete version with WRITE role"

# Test 30: Get Folder Secrets
print_test_header "Get Folder Secrets"
make_request "GET" "/folders/$FOLDER_ID/secrets" "" "200" "$ADMIN_TOKEN" "Get folder secrets"

# Test 31: Search Secrets
print_test_header "Search Secrets"
make_request "GET" "/secrets/search?q=Test" "" "200" "$ADMIN_TOKEN" "Search secrets"

# Test 32: Move Secret to Different Folder
print_test_header "Move Secret to Different Folder"
# Create another folder
FOLDER2_RESPONSE=$(curl -s -X POST "$BASE_URL/folders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Secret Test Folder 2", "description": "Second folder for secret testing", "organizationId": "'$ORG_ID'"}')
FOLDER2_ID=$(echo "$FOLDER2_RESPONSE" | jq -r '.folder.id')

MOVE_SECRET_DATA='{
  "folderId": "'$FOLDER2_ID'"
}'
make_request "PUT" "/secrets/$SECRET_ID/move" "$MOVE_SECRET_DATA" "200" "$ADMIN_TOKEN" "Move secret to different folder"

# Test 33: Move Secret - Non-existent Folder (404)
print_test_header "Move Secret - Non-existent Folder"
MOVE_NONEXISTENT_FOLDER='{
  "folderId": "non-existent-folder-id"
}'
make_request "PUT" "/secrets/$SECRET_ID/move" "$MOVE_NONEXISTENT_FOLDER" "404" "$ADMIN_TOKEN" "Move to non-existent folder"

# Test 34: Move Secret - No Token (401)
print_test_header "Move Secret - No Token"
make_request "PUT" "/secrets/$SECRET_ID/move" "$MOVE_SECRET_DATA" "401" "" "Move secret without token"

# Test 35: Move Secret - VIEW User (403)
print_test_header "Move Secret - VIEW User"
make_request "PUT" "/secrets/$SECRET_ID/move" "$MOVE_SECRET_DATA" "403" "$USER_VIEW_TOKEN" "Move secret with VIEW role"

# Test 36: Delete Secret - No Token (401)
print_test_header "Delete Secret - No Token"
make_request "DELETE" "/secrets/$SECRET_ID" "" "401" "" "Delete secret without token"

# Test 37: Delete Secret - VIEW User (403)
print_test_header "Delete Secret - VIEW User"
make_request "DELETE" "/secrets/$SECRET_ID" "" "403" "$USER_VIEW_TOKEN" "Delete secret with VIEW role"

# Test 38: Delete Secret - WRITE User (200)
print_test_header "Delete Secret - WRITE User"
make_request "DELETE" "/secrets/$MULTI_SECRET_ID" "" "200" "$USER_WRITE_TOKEN" "Delete secret with WRITE role"

# Test 39: Delete Secret - Non-existent (404)
print_test_header "Delete Secret - Non-existent"
make_request "DELETE" "/secrets/non-existent-secret-id" "" "404" "$ADMIN_TOKEN" "Delete non-existent secret"

# Test 40: Delete Secret - Admin (200)
print_test_header "Delete Secret - Admin"
make_request "DELETE" "/secrets/$SECRET_ID" "" "200" "$ADMIN_TOKEN" "Delete secret as admin"

print_info "Secret tests completed."

# Generate test report
generate_test_report
