#!/bin/bash

# Folders API Test Suite
# Tests all folder endpoints with various scenarios

# Load utilities and configuration
source "$(dirname "$0")/test-utils.sh" "$@"

print_section_header "FOLDERS API TESTS"

# Get admin token and organization ID
if [ -f "/tmp/admin_token" ]; then
    ADMIN_TOKEN=$(cat /tmp/admin_token)
else
    print_error "Admin token not found. Please run auth tests first."
    exit 1
fi

# Create a fresh organization for folder tests
print_info "Setting up test organization for folders..."
FOLDER_ORG_DATA=$(get_org_data "folderTest")
ORG_RESPONSE=$(execute_curl "curl -s -X POST '$BASE_URL/organizations' -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '$FOLDER_ORG_DATA'" "Create organization for folder tests")

ORG_ID=$(echo "$ORG_RESPONSE" | jq -r '.organization.id')
if [ "$ORG_ID" = "null" ]; then
    print_error "Failed to create test organization for folders"
    exit 1
fi

# Create test users with different permissions
FOLDER_WRITE_USER=$(get_user_data "folderWrite")
FOLDER_VIEW_USER=$(get_user_data "folderView")

USER_WRITE_TOKEN=$(register_and_login_from_data "$FOLDER_WRITE_USER")
USER_VIEW_TOKEN=$(register_and_login_from_data "$FOLDER_VIEW_USER")

# Add users to organization with specific roles
WRITE_MEMBER_DATA=$(echo "$FOLDER_WRITE_USER" | jq '. | {email: .email, role: "WRITE"}')
VIEW_MEMBER_DATA=$(echo "$FOLDER_VIEW_USER" | jq '. | {email: .email, role: "VIEW"}')

execute_curl "curl -s -X POST '$BASE_URL/organizations/$ORG_ID/members' -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '$WRITE_MEMBER_DATA'" "Add write user to organization" > /dev/null

execute_curl "curl -s -X POST '$BASE_URL/organizations/$ORG_ID/members' -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '$VIEW_MEMBER_DATA'" "Add view user to organization" > /dev/null

# Test 1: Create Root Folder - Valid Data
print_test_header "Create Root Folder - Valid Data"
ROOT_FOLDER_DATA=$(get_folder_data "rootFolder")
make_request "POST" "/organizations/$ORG_ID/folders" "$ROOT_FOLDER_DATA" "201" "$ADMIN_TOKEN" "Create root folder"
  "description": "Main folder for testing secrets",
  "organizationId": "'$ORG_ID'"
ROOT_FOLDER_DATA=$(get_folder_data "rootFolder" | jq --arg orgId "$ORG_ID" '. + {organizationId: $orgId}')
RESPONSE=$(execute_curl "curl -s -X POST '$BASE_URL/folders' -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '$ROOT_FOLDER_DATA'" "Create root folder")

ROOT_FOLDER_ID=$(echo "$RESPONSE" | jq -r '.folder.id')
if [ "$ROOT_FOLDER_ID" != "null" ]; then
    print_success "Root folder created successfully: $ROOT_FOLDER_ID"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Failed to create root folder"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test 2: Create Child Folder - Valid Data
print_test_header "Create Child Folder - Valid Data"
CHILD_FOLDER_DATA=$(get_folder_data "childFolder" | jq --arg orgId "$ORG_ID" --arg parentId "$ROOT_FOLDER_ID" '. + {organizationId: $orgId, parentId: $parentId}')
RESPONSE=$(execute_curl "curl -s -X POST '$BASE_URL/folders' -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '$CHILD_FOLDER_DATA'" "Create child folder")

CHILD_FOLDER_ID=$(echo "$RESPONSE" | jq -r '.folder.id')
if [ "$CHILD_FOLDER_ID" != "null" ]; then
    print_success "Child folder created successfully: $CHILD_FOLDER_ID"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Failed to create child folder"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test 3: Create Folder - No Token (401)
print_test_header "Create Folder - No Token"
make_request "POST" "/folders" "$ROOT_FOLDER_DATA" "401" "" "Create folder without token"

# Test 4: Create Folder - Missing Name (400)
print_test_header "Create Folder - Missing Name"
INVALID_FOLDER_DATA=$(get_folder_data "missingName" | jq --arg orgId "$ORG_ID" '. + {organizationId: $orgId}')
make_request "POST" "/folders" "$INVALID_FOLDER_DATA" "400" "$ADMIN_TOKEN" "Missing folder name"

# Test 5: Create Folder - Missing Organization ID (400)
print_test_header "Create Folder - Missing Organization ID"
NO_ORG_FOLDER_DATA='{
  "name": "No Org Folder",
  "description": "Folder without organization ID"
}'
make_request "POST" "/folders" "$NO_ORG_FOLDER_DATA" "400" "$ADMIN_TOKEN" "Missing organization ID"

# Test 6: Create Folder - Non-existent Organization (404)
print_test_header "Create Folder - Non-existent Organization"
NONEXISTENT_ORG_FOLDER_DATA='{
  "name": "Test Folder",
  "description": "Folder in non-existent org",
  "organizationId": "non-existent-org-id"
}'
make_request "POST" "/folders" "$NONEXISTENT_ORG_FOLDER_DATA" "404" "$ADMIN_TOKEN" "Non-existent organization"

# Test 7: Create Folder - Non-existent Parent (404)
print_test_header "Create Folder - Non-existent Parent"
NONEXISTENT_PARENT_FOLDER_DATA='{
  "name": "Test Folder",
  "description": "Folder with non-existent parent",
  "organizationId": "'$ORG_ID'",
  "parentId": "non-existent-parent-id"
}'
make_request "POST" "/folders" "$NONEXISTENT_PARENT_FOLDER_DATA" "404" "$ADMIN_TOKEN" "Non-existent parent folder"

# Test 8: Create Folder - Duplicate Name (409)
print_test_header "Create Folder - Duplicate Name"
make_request "POST" "/folders" "$ROOT_FOLDER_DATA" "409" "$ADMIN_TOKEN" "Duplicate folder name"

# Test 9: Create Folder - VIEW User (403)
print_test_header "Create Folder - VIEW User"
VIEW_FOLDER_DATA='{
  "name": "View User Folder",
  "description": "Folder by view user",
  "organizationId": "'$ORG_ID'"
}'
make_request "POST" "/folders" "$VIEW_FOLDER_DATA" "403" "$USER_VIEW_TOKEN" "Create folder with VIEW role"

# Test 10: Create Folder - WRITE User (201)
print_test_header "Create Folder - WRITE User"
WRITE_FOLDER_DATA='{
  "name": "Write User Folder",
  "description": "Folder by write user",
  "organizationId": "'$ORG_ID'"
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/folders" \
  -H "Authorization: Bearer $USER_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$WRITE_FOLDER_DATA")

WRITE_FOLDER_ID=$(echo "$RESPONSE" | jq -r '.folder.id')
if [ "$WRITE_FOLDER_ID" != "null" ]; then
    print_success "WRITE user folder created successfully"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Failed to create folder with WRITE user"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test 11: Get Folder by ID
print_test_header "Get Folder by ID"
make_request "GET" "/folders/$ROOT_FOLDER_ID" "" "200" "$ADMIN_TOKEN" "Get folder by ID"

# Test 12: Get Folder by ID - Non-existent (404)
print_test_header "Get Folder by ID - Non-existent"
make_request "GET" "/folders/non-existent-folder-id" "" "404" "$ADMIN_TOKEN" "Non-existent folder"

# Test 13: Get Folder by ID - No Token (401)
print_test_header "Get Folder by ID - No Token"
make_request "GET" "/folders/$ROOT_FOLDER_ID" "" "401" "" "Get folder without token"

# Test 14: Get Folder by ID - VIEW User (200)
print_test_header "Get Folder by ID - VIEW User"
make_request "GET" "/folders/$ROOT_FOLDER_ID" "" "200" "$USER_VIEW_TOKEN" "Get folder with VIEW role"

# Test 15: Update Folder - Valid Data
print_test_header "Update Folder - Valid Data"
UPDATE_FOLDER_DATA='{
  "name": "Updated Test Folder",
  "description": "Updated description for test folder"
}'
make_request "PUT" "/folders/$ROOT_FOLDER_ID" "$UPDATE_FOLDER_DATA" "200" "$ADMIN_TOKEN" "Update folder"

# Test 16: Update Folder - No Token (401)
print_test_header "Update Folder - No Token"
make_request "PUT" "/folders/$ROOT_FOLDER_ID" "$UPDATE_FOLDER_DATA" "401" "" "Update folder without token"

# Test 17: Update Folder - VIEW User (403)
print_test_header "Update Folder - VIEW User"
make_request "PUT" "/folders/$ROOT_FOLDER_ID" "$UPDATE_FOLDER_DATA" "403" "$USER_VIEW_TOKEN" "Update folder with VIEW role"

# Test 18: Update Folder - WRITE User (200)
print_test_header "Update Folder - WRITE User"
make_request "PUT" "/folders/$WRITE_FOLDER_ID" "$UPDATE_FOLDER_DATA" "200" "$USER_WRITE_TOKEN" "Update folder with WRITE role"

# Test 19: Update Folder - Non-existent (404)
print_test_header "Update Folder - Non-existent"
make_request "PUT" "/folders/non-existent-folder-id" "$UPDATE_FOLDER_DATA" "404" "$ADMIN_TOKEN" "Update non-existent folder"

# Test 20: Update Folder - Duplicate Name (409)
print_test_header "Update Folder - Duplicate Name"
DUPLICATE_NAME_UPDATE='{
  "name": "Write User Folder"
}'
make_request "PUT" "/folders/$ROOT_FOLDER_ID" "$DUPLICATE_NAME_UPDATE" "409" "$ADMIN_TOKEN" "Update folder with duplicate name"

# Test 21: Move Folder - Valid Data
print_test_header "Move Folder - Valid Data"
MOVE_FOLDER_DATA='{
  "parentId": "'$ROOT_FOLDER_ID'"
}'
make_request "POST" "/folders/$WRITE_FOLDER_ID/move" "$MOVE_FOLDER_DATA" "200" "$ADMIN_TOKEN" "Move folder"

# Test 22: Move Folder - Create Cycle (409)
print_test_header "Move Folder - Create Cycle"
CYCLE_MOVE_DATA='{
  "parentId": "'$CHILD_FOLDER_ID'"
}'
make_request "POST" "/folders/$ROOT_FOLDER_ID/move" "$CYCLE_MOVE_DATA" "409" "$ADMIN_TOKEN" "Move folder creating cycle"

# Test 23: Move Folder - Non-existent Parent (404)
print_test_header "Move Folder - Non-existent Parent"
NONEXISTENT_PARENT_MOVE='{
  "parentId": "non-existent-parent-id"
}'
make_request "POST" "/folders/$CHILD_FOLDER_ID/move" "$NONEXISTENT_PARENT_MOVE" "404" "$ADMIN_TOKEN" "Move to non-existent parent"

# Test 24: Move Folder - No Token (401)
print_test_header "Move Folder - No Token"
make_request "POST" "/folders/$CHILD_FOLDER_ID/move" "$MOVE_FOLDER_DATA" "401" "" "Move folder without token"

# Test 25: Move Folder - VIEW User (403)
print_test_header "Move Folder - VIEW User"
make_request "POST" "/folders/$CHILD_FOLDER_ID/move" "$MOVE_FOLDER_DATA" "403" "$USER_VIEW_TOKEN" "Move folder with VIEW role"

# Test 26: Get Folder Path
print_test_header "Get Folder Path"
make_request "GET" "/folders/$CHILD_FOLDER_ID/path" "" "200" "$ADMIN_TOKEN" "Get folder path"

# Test 27: Get Folder Path - Non-existent (404)
print_test_header "Get Folder Path - Non-existent"
make_request "GET" "/folders/non-existent-folder-id/path" "" "404" "$ADMIN_TOKEN" "Get path for non-existent folder"

# Test 28: Get Folder Path - No Token (401)
print_test_header "Get Folder Path - No Token"
make_request "GET" "/folders/$CHILD_FOLDER_ID/path" "" "401" "" "Get folder path without token"

# Test 29: Get Organization Folders
print_test_header "Get Organization Folders"
make_request "GET" "/organizations/$ORG_ID/folders" "" "200" "$ADMIN_TOKEN" "Get organization folders"

# Test 30: Get Organization Folder Tree
print_test_header "Get Organization Folder Tree"
make_request "GET" "/organizations/$ORG_ID/folders/tree" "" "200" "$ADMIN_TOKEN" "Get organization folder tree"

# Test 31: Delete Folder - Non-empty (409)
print_test_header "Delete Folder - Non-empty"
make_request "DELETE" "/folders/$ROOT_FOLDER_ID" "" "409" "$ADMIN_TOKEN" "Delete non-empty folder"

# Test 32: Delete Folder - Force Delete
print_test_header "Delete Folder - Force Delete"
make_request "DELETE" "/folders/$ROOT_FOLDER_ID?force=true" "" "200" "$ADMIN_TOKEN" "Force delete folder"

# Test 33: Delete Folder - Non-existent (404)
print_test_header "Delete Folder - Non-existent"
make_request "DELETE" "/folders/non-existent-folder-id" "" "404" "$ADMIN_TOKEN" "Delete non-existent folder"

# Test 34: Delete Folder - No Token (401)
print_test_header "Delete Folder - No Token"
make_request "DELETE" "/folders/$WRITE_FOLDER_ID" "" "401" "" "Delete folder without token"

# Test 35: Delete Folder - VIEW User (403)
print_test_header "Delete Folder - VIEW User"
make_request "DELETE" "/folders/$WRITE_FOLDER_ID" "" "403" "$USER_VIEW_TOKEN" "Delete folder with VIEW role"

# Test 36: Delete Folder - WRITE User (200)
print_test_header "Delete Folder - WRITE User"
# Create a new folder for the WRITE user to delete
DELETE_FOLDER_DATA=$(get_folder_data "deleteTest" | jq --arg orgId "$ORG_ID" '. + {organizationId: $orgId}')
DELETE_FOLDER_RESPONSE=$(execute_curl "curl -s -X POST '$BASE_URL/folders' -H 'Authorization: Bearer $USER_WRITE_TOKEN' -H 'Content-Type: application/json' -d '$DELETE_FOLDER_DATA'" "Create folder for deletion test")

DELETE_FOLDER_ID=$(echo "$DELETE_FOLDER_RESPONSE" | jq -r '.folder.id')
make_request "DELETE" "/folders/$DELETE_FOLDER_ID" "" "200" "$USER_WRITE_TOKEN" "Delete folder with WRITE role"

print_info "Folder tests completed."

# Generate test report
generate_test_report# Get admin token (created in auth tests)
if [ -f "/tmp/admin_token" ]; then
    ADMIN_TOKEN=$(cat /tmp/admin_token)
else
    print_error "Admin token not found. Please run test-auth.sh first."
    exit 1
fi

# Create a fresh organization for folder tests
print_info "Setting up organization for folder tests..."
ORG_ID=$(create_organization "$ADMIN_TOKEN" "Folder Test Org" "Organization for testing folders")
if [ "$ORG_ID" = "null" ]; then
    print_error "Failed to create organization for folder tests"
    exit 1
fi
print_success "Organization created: $ORG_ID"

# Create a test user with VIEW permissions
VIEW_USER_TOKEN=$(register_and_login "folderview@example.com" "folderview" "FolderView123!" "Folder" "View")
if [ "$VIEW_USER_TOKEN" = "null" ]; then
    print_error "Failed to create view user for folder tests"
    exit 1
fi

# Add view user to organization
ADD_MEMBER_DATA='{
  "email": "folderview@example.com",
  "role": "VIEW"
}'
curl -s -X POST "$BASE_URL/organizations/$ORG_ID/members" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ADD_MEMBER_DATA" > /dev/null

print_success "View user added to organization"

# Test 1: Create Folder - Valid Data (Root Level)
print_test_header "Create Folder - Valid Data (Root Level)"
ROOT_FOLDER_DATA='{
  "name": "Test Folder",
  "description": "Main folder for testing secrets",
  "organizationId": "'$ORG_ID'"
}'
RESPONSE=$(curl -s -w '%{http_code}' -X POST "$BASE_URL/folders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ROOT_FOLDER_DATA")

STATUS_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

if [ "$STATUS_CODE" = "201" ]; then
    print_success "Root folder created successfully"
    ROOT_FOLDER_ID=$(echo "$BODY" | jq -r '.folder.id')
    echo "$ROOT_FOLDER_ID" > /tmp/test_folder_id
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Root folder creation failed - Status: $STATUS_CODE"
    echo "Response: $BODY"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test 2: Create Subfolder - Valid Data
print_test_header "Create Subfolder - Valid Data"
SUB_FOLDER_DATA='{
  "name": "Sub Folder",
  "description": "Subfolder for testing",
  "organizationId": "'$ORG_ID'",
  "parentId": "'$ROOT_FOLDER_ID'"
}'
RESPONSE=$(curl -s -w '%{http_code}' -X POST "$BASE_URL/folders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$SUB_FOLDER_DATA")

STATUS_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

if [ "$STATUS_CODE" = "201" ]; then
    print_success "Subfolder created successfully"
    SUB_FOLDER_ID=$(echo "$BODY" | jq -r '.folder.id')
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Subfolder creation failed - Status: $STATUS_CODE"
    echo "Response: $BODY"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))

# Test 3: Create Folder - Duplicate Name (409)
print_test_header "Create Folder - Duplicate Name"
make_request "POST" "/folders" "$ROOT_FOLDER_DATA" "409" "$ADMIN_TOKEN" "Duplicate folder name"

# Test 4: Create Folder - Missing Name (400)
print_test_header "Create Folder - Missing Name"
INVALID_FOLDER_DATA='{
  "description": "Folder without name",
  "organizationId": "'$ORG_ID'"
}'
make_request "POST" "/folders" "$INVALID_FOLDER_DATA" "400" "$ADMIN_TOKEN" "Missing folder name"

# Test 5: Create Folder - Missing Organization ID (400)
print_test_header "Create Folder - Missing Organization ID"
NO_ORG_FOLDER_DATA='{
  "name": "No Org Folder",
  "description": "Folder without organization"
}'
make_request "POST" "/folders" "$NO_ORG_FOLDER_DATA" "400" "$ADMIN_TOKEN" "Missing organization ID"

# Test 6: Create Folder - Invalid Parent ID (404)
print_test_header "Create Folder - Invalid Parent ID"
INVALID_PARENT_DATA='{
  "name": "Invalid Parent Folder",
  "description": "Folder with invalid parent",
  "organizationId": "'$ORG_ID'",
  "parentId": "invalid-parent-id"
}'
make_request "POST" "/folders" "$INVALID_PARENT_DATA" "404" "$ADMIN_TOKEN" "Invalid parent ID"

# Test 7: Create Folder - Insufficient Permissions (403)
print_test_header "Create Folder - Insufficient Permissions"
make_request "POST" "/folders" "$ROOT_FOLDER_DATA" "403" "$VIEW_USER_TOKEN" "Insufficient permissions to create folder"

# Test 8: Create Folder - No Authentication (401)
print_test_header "Create Folder - No Authentication"
make_request "POST" "/folders" "$ROOT_FOLDER_DATA" "401" "" "No authentication token"

# Test 9: Get Folder by ID
print_test_header "Get Folder by ID"
make_request "GET" "/folders/$ROOT_FOLDER_ID" "" "200" "$ADMIN_TOKEN" "Get folder by ID"

# Test 10: Get Folder by ID - View User (200)
print_test_header "Get Folder by ID - View User"
make_request "GET" "/folders/$ROOT_FOLDER_ID" "" "200" "$VIEW_USER_TOKEN" "View user accessing folder"

# Test 11: Get Folder by ID - Invalid ID (404)
print_test_header "Get Folder by ID - Invalid ID"
make_request "GET" "/folders/invalid-folder-id" "" "404" "$ADMIN_TOKEN" "Invalid folder ID"

# Test 12: Get Folder by ID - No Authentication (401)
print_test_header "Get Folder by ID - No Authentication"
make_request "GET" "/folders/$ROOT_FOLDER_ID" "" "401" "" "No authentication token"

# Test 13: Update Folder - Valid Data
print_test_header "Update Folder - Valid Data"
UPDATE_FOLDER_DATA='{
  "name": "Updated Test Folder",
  "description": "Updated description for the folder"
}'
make_request "PUT" "/folders/$ROOT_FOLDER_ID" "$UPDATE_FOLDER_DATA" "200" "$ADMIN_TOKEN" "Update folder"

# Test 14: Update Folder - Duplicate Name (409)
print_test_header "Update Folder - Duplicate Name"
DUPLICATE_NAME_DATA='{
  "name": "Sub Folder"
}'
make_request "PUT" "/folders/$ROOT_FOLDER_ID" "$DUPLICATE_NAME_DATA" "409" "$ADMIN_TOKEN" "Duplicate folder name in update"

# Test 15: Update Folder - Insufficient Permissions (403)
print_test_header "Update Folder - Insufficient Permissions"
make_request "PUT" "/folders/$ROOT_FOLDER_ID" "$UPDATE_FOLDER_DATA" "403" "$VIEW_USER_TOKEN" "Insufficient permissions to update folder"

# Test 16: Update Folder - Invalid ID (404)
print_test_header "Update Folder - Invalid ID"
make_request "PUT" "/folders/invalid-folder-id" "$UPDATE_FOLDER_DATA" "404" "$ADMIN_TOKEN" "Invalid folder ID for update"

# Test 17: Move Folder - Valid Data
print_test_header "Move Folder - Valid Data"
MOVE_FOLDER_DATA='{
  "parentId": "'$ROOT_FOLDER_ID'"
}'

# Create another folder to move
MOVABLE_FOLDER_DATA='{
  "name": "Movable Folder",
  "description": "Folder to be moved",
  "organizationId": "'$ORG_ID'"
}'
MOVABLE_RESPONSE=$(curl -s -X POST "$BASE_URL/folders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$MOVABLE_FOLDER_DATA")
MOVABLE_FOLDER_ID=$(echo "$MOVABLE_RESPONSE" | jq -r '.folder.id')

make_request "POST" "/folders/$MOVABLE_FOLDER_ID/move" "$MOVE_FOLDER_DATA" "200" "$ADMIN_TOKEN" "Move folder"

# Test 18: Move Folder - Create Cycle (409)
print_test_header "Move Folder - Create Cycle"
CYCLE_MOVE_DATA='{
  "parentId": "'$SUB_FOLDER_ID'"
}'
make_request "POST" "/folders/$ROOT_FOLDER_ID/move" "$CYCLE_MOVE_DATA" "409" "$ADMIN_TOKEN" "Create cycle in folder hierarchy"

# Test 19: Move Folder - Invalid Parent (404)
print_test_header "Move Folder - Invalid Parent"
INVALID_MOVE_DATA='{
  "parentId": "invalid-parent-id"
}'
make_request "POST" "/folders/$SUB_FOLDER_ID/move" "$INVALID_MOVE_DATA" "404" "$ADMIN_TOKEN" "Invalid parent for move"

# Test 20: Move Folder - Insufficient Permissions (403)
print_test_header "Move Folder - Insufficient Permissions"
make_request "POST" "/folders/$SUB_FOLDER_ID/move" "$MOVE_FOLDER_DATA" "403" "$VIEW_USER_TOKEN" "Insufficient permissions to move folder"

# Test 21: Get Folder Path (Breadcrumb)
print_test_header "Get Folder Path (Breadcrumb)"
make_request "GET" "/folders/$SUB_FOLDER_ID/path" "" "200" "$ADMIN_TOKEN" "Get folder breadcrumb path"

# Test 22: Get Folder Path - Invalid ID (404)
print_test_header "Get Folder Path - Invalid ID"
make_request "GET" "/folders/invalid-folder-id/path" "" "404" "$ADMIN_TOKEN" "Invalid folder ID for path"

# Test 23: Get Organization Folders
print_test_header "Get Organization Folders"
make_request "GET" "/organizations/$ORG_ID/folders" "" "200" "$ADMIN_TOKEN" "Get organization folders"

# Test 24: Get Organization Folder Tree
print_test_header "Get Organization Folder Tree"
make_request "GET" "/organizations/$ORG_ID/folders/tree" "" "200" "$ADMIN_TOKEN" "Get organization folder tree"

# Test 25: Delete Folder - Contains Items (409)
print_test_header "Delete Folder - Contains Items"
make_request "DELETE" "/folders/$ROOT_FOLDER_ID" "" "409" "$ADMIN_TOKEN" "Delete folder with children"

# Test 26: Delete Folder - Force Delete
print_test_header "Delete Folder - Force Delete"
make_request "DELETE" "/folders/$SUB_FOLDER_ID?force=true" "" "200" "$ADMIN_TOKEN" "Force delete folder"

# Test 27: Delete Folder - Already Deleted (404)
print_test_header "Delete Folder - Already Deleted"
make_request "DELETE" "/folders/$SUB_FOLDER_ID" "" "404" "$ADMIN_TOKEN" "Delete already deleted folder"

# Test 28: Delete Folder - Insufficient Permissions (403)
print_test_header "Delete Folder - Insufficient Permissions"
make_request "DELETE" "/folders/$MOVABLE_FOLDER_ID" "" "403" "$VIEW_USER_TOKEN" "Insufficient permissions to delete folder"

# Test 29: Delete Folder - Valid Delete (Empty)
print_test_header "Delete Folder - Valid Delete (Empty)"
make_request "DELETE" "/folders/$MOVABLE_FOLDER_ID" "" "200" "$ADMIN_TOKEN" "Delete empty folder"

# Test 30: Delete Folder - Invalid ID (404)
print_test_header "Delete Folder - Invalid ID"
make_request "DELETE" "/folders/invalid-folder-id" "" "404" "$ADMIN_TOKEN" "Invalid folder ID for delete"

# Cleanup test data
print_info "Cleaning up test data..."
# Force delete remaining folders
curl -s -X DELETE "$BASE_URL/folders/$ROOT_FOLDER_ID?force=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

# Generate test report
generate_test_report
