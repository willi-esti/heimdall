#!/bin/bash

# Test utilities for Heimdall API testing
# This file contains common functions used across all test scripts

# Parse command line arguments for all test scripts
PAUSE_AFTER_TEST=false
ECHO_CURL=false

# Parse arguments passed to test scripts
while [[ $# -gt 0 ]]; do
    case $1 in
        --pause|-p)
            PAUSE_AFTER_TEST=true
            shift
            ;;
        --echo-curl|-e)
            ECHO_CURL=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --pause, -p      Pause after each test and wait for user input"
            echo "  --echo-curl, -e  Echo the curl commands being executed"
            echo "  --help, -h       Show this help message"
            exit 0
            ;;
        *)
            # Unknown option, ignore or handle as needed
            shift
            ;;
    esac
done

# Load configuration
CONFIG_FILE="$(dirname "$0")/test-config.json"
BASE_URL=$(jq -r '.baseUrl' "$CONFIG_FILE")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_test_header() {
    echo -e "\n${BLUE}🧪 Test: $1${NC}"
    echo "----------------------------------------"
}

print_section_header() {
    echo -e "\n${YELLOW}📋 $1${NC}"
    echo "========================================"
}

# Function to pause after test if enabled
pause_if_enabled() {
    if [ "$PAUSE_AFTER_TEST" = true ]; then
        echo -e "\n${YELLOW}⏸️  Press Enter to continue to next test...${NC}"
        read -r
    fi
}

# Function to execute curl with optional echo
execute_curl() {
    local curl_cmd="$1"
    local description="$2"
    
    if [ "$ECHO_CURL" = true ] && [ -n "$description" ]; then
        echo -e "${CYAN}🔧 Curl Command ($description):${NC}"
        echo "$curl_cmd"
        echo
    fi
    
    eval "$curl_cmd"
}

# Function to make HTTP requests and validate responses
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="$4"
    local token="$5"
    local test_name="$6"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Build curl command
    local curl_cmd="curl -s -w '%{http_code}' -X $method"
    
    if [ -n "$token" ]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $token'"
    fi
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    curl_cmd="$curl_cmd '$BASE_URL$endpoint'"
    
    # Echo curl command if enabled
    if [ "$ECHO_CURL" = true ]; then
        echo -e "${CYAN}🔧 Curl Command:${NC}"
        # Format for easy copy-paste
        local display_cmd="curl -X $method"
        if [ -n "$token" ]; then
            display_cmd="$display_cmd \\\\\n  -H 'Authorization: Bearer $token'"
        fi
        if [ -n "$data" ]; then
            display_cmd="$display_cmd \\\\\n  -H 'Content-Type: application/json' \\\\\n  -d '$data'"
        fi
        display_cmd="$display_cmd \\\\\n  '$BASE_URL$endpoint'"
        echo -e "$display_cmd"
        echo
    fi
    
    # Execute request
    local response=$(eval $curl_cmd)
    local status_code="${response: -3}"
    local body="${response%???}"
    
    # Validate status code
    if [ "$status_code" = "$expected_status" ]; then
        print_success "$test_name - Status: $status_code"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo "$body" | jq . 2>/dev/null || echo "$body"
        pause_if_enabled
        return 0
    else
        print_error "$test_name - Expected: $expected_status, Got: $status_code"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "Response body: $body"
        pause_if_enabled
        return 1
    fi
}

# Function to register a user and return token
register_and_login() {
    local email="$1"
    local username="$2"
    local password="$3"
    local firstName="$4"
    local lastName="$5"
    
    # Register user
    local register_data="{\"email\":\"$email\",\"username\":\"$username\",\"password\":\"$password\",\"firstName\":\"$firstName\",\"lastName\":\"$lastName\"}"
    local register_response=$(curl -s -X POST "$BASE_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d "$register_data")
    
    # Login and get token
    local login_data="{\"email\":\"$email\",\"password\":\"$password\"}"
    local login_response=$(curl -s -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "$login_data")
    
    # Extract token
    echo "$login_response" | jq -r '.token'
}

# Function to register a user from config data and return token (handles existing users)
register_and_login_from_data() {
    local user_data="$1"
    
    # Extract fields from JSON data
    local email=$(echo "$user_data" | jq -r '.email')
    local username=$(echo "$user_data" | jq -r '.username')
    local password=$(echo "$user_data" | jq -r '.password')
    local firstName=$(echo "$user_data" | jq -r '.firstName')
    local lastName=$(echo "$user_data" | jq -r '.lastName')
    
    # Try to register user first
    local register_response=$(curl -s -X POST "$BASE_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d "$user_data")
    
    # Check if registration was successful
    if echo "$register_response" | jq -e '.token' > /dev/null 2>&1; then
        # Registration successful, return token
        echo "$register_response" | jq -r '.token'
        return 0
    fi
    
    # Registration failed (likely user exists), try to login
    local login_data="{\"identifier\":\"$email\",\"password\":\"$password\"}"
    local login_response=$(curl -s -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "$login_data")
    
    # Check if login was successful
    if echo "$login_response" | jq -e '.token' > /dev/null 2>&1; then
        # Login successful, return token
        echo "$login_response" | jq -r '.token'
        return 0
    fi
    
    # Both registration and login failed
    return 1
}

# Function to create organization and return ID
create_organization() {
    local token="$1"
    local name="$2"
    local description="$3"
    
    local org_data="{\"name\":\"$name\",\"description\":\"$description\"}"
    local org_response=$(curl -s -X POST "$BASE_URL/organizations" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "$org_data")
    
    echo "$org_response" | jq -r '.organization.id'
}

# Function to create folder and return ID
create_folder() {
    local token="$1"
    local name="$2"
    local description="$3"
    local org_id="$4"
    local parent_id="$5"
    
    local folder_data="{\"name\":\"$name\",\"description\":\"$description\",\"organizationId\":\"$org_id\""
    if [ -n "$parent_id" ]; then
        folder_data="$folder_data,\"parentId\":\"$parent_id\""
    fi
    folder_data="$folder_data}"
    
    local folder_response=$(curl -s -X POST "$BASE_URL/folders" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "$folder_data")
    
    echo "$folder_response" | jq -r '.folder.id'
}

# Function to create secret and return ID
create_secret() {
    local token="$1"
    local name="$2"
    local description="$3"
    local value="$4"
    local type="$5"
    local folder_id="$6"
    
    local secret_data="{\"name\":\"$name\",\"description\":\"$description\",\"value\":\"$value\",\"type\":\"$type\",\"folderId\":\"$folder_id\"}"
    local secret_response=$(curl -s -X POST "$BASE_URL/secrets" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "$secret_data")
    
    echo "$secret_response" | jq -r '.secret.id'
}

# Function to cleanup test data
cleanup_test_user() {
    local email="$1"
    # Note: We'll need to add cleanup endpoints or use the existing delete operations
    print_info "Cleanup: Would delete user $email and associated data"
}

# Function to generate test report
generate_test_report() {
    echo ""
    echo "========================================"
    echo "📊 TEST RESULTS SUMMARY"
    echo "========================================"
    echo "Total Tests: $TESTS_RUN"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        print_success "All tests passed! 🎉"
        return 0
    else
        print_error "$TESTS_FAILED tests failed"
        return 1
    fi
}

# Function to wait for user input (for manual testing)
wait_for_input() {
    read -p "Press Enter to continue..." </dev/tty
}

# Function to validate JSON response structure
validate_json_field() {
    local json="$1"
    local field="$2"
    local expected_type="$3"
    
    local value=$(echo "$json" | jq -r ".$field")
    if [ "$value" = "null" ]; then
        print_error "Field '$field' is missing or null"
        return 1
    fi
    
    # Basic type validation
    case $expected_type in
        "string")
            if [ -z "$value" ]; then
                print_error "Field '$field' should not be empty"
                return 1
            fi
            ;;
        "array")
            local length=$(echo "$json" | jq ".$field | length")
            if [ "$length" = "null" ]; then
                print_error "Field '$field' should be an array"
                return 1
            fi
            ;;
    esac
    
    return 0
}

# Export functions for use in other scripts
export -f print_success print_error print_warning print_info
export -f print_test_header print_section_header
export -f make_request register_and_login register_and_login_from_data create_organization create_folder create_secret
export -f cleanup_test_user generate_test_report wait_for_input validate_json_field
export -f get_user_data get_org_data get_folder_data get_secret_data get_invite_data get_login_data
export -f get_user_data get_org_data get_folder_data get_secret_data get_invite_data get_login_data
