#!/bin/bash

# Authentication API Test Suite
# Tests all authentication endpoints with various scenarios

# Load utilities and configuration
source "$(dirname "$0")/test-utils.sh" "$@"

print_section_header "AUTHENTICATION API TESTS"

# Test data
VALID_USER=$(jq -r '.testData.users[0]' "$(dirname "$0")/test-config.json")
INVALID_USER='{"email":"invalid@example.com","username":"invalid","password":"invalid"}'

# Test 1: User Registration - Valid Data
print_test_header "User Registration - Valid Data"
REGISTER_DATA='{
  "email": "testuser1@example.com",
  "username": "testuser1",
  "password": "TestUser123!",
  "firstName": "Test",
  "lastName": "User1"
}'

make_request "POST" "/auth/register" "$REGISTER_DATA" "201" "" "Valid user registration"

# Test 2: User Registration - Duplicate Email (409)
print_test_header "User Registration - Duplicate Email"
make_request "POST" "/auth/register" "$REGISTER_DATA" "409" "" "Duplicate email registration"

# Test 3: User Registration - Invalid Email (400)
print_test_header "User Registration - Invalid Email"
INVALID_EMAIL_DATA='{
  "email": "invalid-email",
  "username": "testuser2",
  "password": "TestUser123!",
  "firstName": "Test",
  "lastName": "User2"
}'
make_request "POST" "/auth/register" "$INVALID_EMAIL_DATA" "400" "" "Invalid email format"

# Test 4: User Registration - Missing Password (400)
print_test_header "User Registration - Missing Password"
NO_PASSWORD_DATA='{
  "email": "testuser3@example.com",
  "username": "testuser3",
  "firstName": "Test",
  "lastName": "User3"
}'
make_request "POST" "/auth/register" "$NO_PASSWORD_DATA" "400" "" "Missing password"

# Test 5: User Registration - Short Password (400)
print_test_header "User Registration - Short Password"
SHORT_PASSWORD_DATA='{
  "email": "testuser4@example.com",
  "username": "testuser4",
  "password": "123",
  "firstName": "Test",
  "lastName": "User4"
}'
make_request "POST" "/auth/register" "$SHORT_PASSWORD_DATA" "400" "" "Short password"

# Test 6: User Login - Valid Credentials (Email)
print_test_header "User Login - Valid Credentials (Email)"
LOGIN_DATA='{
  "email": "testuser1@example.com",
  "password": "TestUser123!"
}'
RESPONSE=$(execute_curl "curl -s -X POST '$BASE_URL/auth/login' -H 'Content-Type: application/json' -d '$LOGIN_DATA'" "User login")

# Extract token for subsequent tests
TOKEN=$(echo "$RESPONSE" | jq -r '.token')
if [ "$TOKEN" != "null" ]; then
    print_success "Login successful - Token received"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Login failed - No token received"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))
pause_if_enabled

# Test 7: User Login - Valid Credentials (Username)
print_test_header "User Login - Valid Credentials (Username)"
LOGIN_USERNAME_DATA='{
  "username": "testuser1",
  "password": "TestUser123!"
}'
make_request "POST" "/auth/login" "$LOGIN_USERNAME_DATA" "200" "" "Login with username"

# Test 8: User Login - Invalid Credentials (401)
print_test_header "User Login - Invalid Credentials"
INVALID_LOGIN_DATA='{
  "email": "testuser1@example.com",
  "password": "WrongPassword123!"
}'
make_request "POST" "/auth/login" "$INVALID_LOGIN_DATA" "401" "" "Invalid credentials"

# Test 9: User Login - Non-existent User (401)
print_test_header "User Login - Non-existent User"
NONEXISTENT_LOGIN_DATA='{
  "email": "nonexistent@example.com",
  "password": "TestUser123!"
}'
make_request "POST" "/auth/login" "$NONEXISTENT_LOGIN_DATA" "401" "" "Non-existent user"

# Test 10: User Login - Missing Password (400)
print_test_header "User Login - Missing Password"
NO_PASSWORD_LOGIN_DATA='{
  "email": "testuser1@example.com"
}'
make_request "POST" "/auth/login" "$NO_PASSWORD_LOGIN_DATA" "400" "" "Missing password in login"

# Test 11: User Login - Missing Email/Username (400)
print_test_header "User Login - Missing Email/Username"
NO_EMAIL_LOGIN_DATA='{
  "password": "TestUser123!"
}'
make_request "POST" "/auth/login" "$NO_EMAIL_LOGIN_DATA" "400" "" "Missing email/username"

# Test 12: Get Current User - Valid Token
print_test_header "Get Current User - Valid Token"
make_request "GET" "/auth/me" "" "200" "$TOKEN" "Get current user info"

# Test 13: Get Current User - No Token (401)
print_test_header "Get Current User - No Token"
make_request "GET" "/auth/me" "" "401" "" "No authentication token"

# Test 14: Get Current User - Invalid Token (401)
print_test_header "Get Current User - Invalid Token"
make_request "GET" "/auth/me" "" "401" "invalid.token.here" "Invalid authentication token"

# Test 15: Refresh Token - Valid Token
print_test_header "Refresh Token - Valid Token"
make_request "POST" "/auth/refresh" "" "200" "$TOKEN" "Refresh authentication token"

# Test 16: Refresh Token - No Token (401)
print_test_header "Refresh Token - No Token"
make_request "POST" "/auth/refresh" "" "401" "" "Refresh without token"

# Test 17: Refresh Token - Invalid Token (401)
print_test_header "Refresh Token - Invalid Token"
make_request "POST" "/auth/refresh" "" "401" "invalid.token.here" "Refresh with invalid token"

# Test 18: Register Admin User (Fixed Data)
print_test_header "Register Admin User (Fixed Data)"
ADMIN_DATA=$(jq -c '.fixedData.user' "$(dirname "$0")/test-config.json")
make_request "POST" "/auth/register" "$ADMIN_DATA" "201" "" "Register admin user"

# Test 19: Login Admin User and Store Token
print_test_header "Login Admin User"
ADMIN_LOGIN_DATA='{
  "email": "admin@gmail.com",
  "password": "admin"
}'
ADMIN_RESPONSE=$(execute_curl "curl -s -X POST '$BASE_URL/auth/login' -H 'Content-Type: application/json' -d '$ADMIN_LOGIN_DATA'" "Admin login")

ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r '.token')
if [ "$ADMIN_TOKEN" != "null" ]; then
    print_success "Admin login successful"
    # Save admin token for other test scripts
    echo "$ADMIN_TOKEN" > /tmp/admin_token
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    print_error "Admin login failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_RUN=$((TESTS_RUN + 1))
pause_if_enabled

# Cleanup test user (Note: In a real scenario, we'd implement a cleanup endpoint)
print_info "Note: Test user 'testuser1@example.com' should be manually cleaned up if needed"
print_info "Run ./cleanup-test-data.sh to clean up test organizations and temporary files"

# Generate test report
generate_test_report
