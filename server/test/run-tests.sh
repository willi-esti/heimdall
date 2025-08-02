#!/bin/bash

# Master Test Runner
# Allows selection of which test script(s) to run

# Store original arguments to pass to test scripts
ORIGINAL_ARGS="$@"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test script directory
SCRIPT_DIR="$(dirname "$0")"

# Available test scripts
declare -A TEST_SCRIPTS=(
    ["auth"]="Authentication API Tests"
    ["organizations"]="Organizations API Tests"
    ["folders"]="Folders API Tests"
    ["secrets"]="Secrets API Tests"
    ["invites"]="Invites API Tests"
    ["cleanup"]="Cleanup Test Data"
)

# Ordered array for consistent menu display
TEST_ORDER=("auth" "organizations" "folders" "secrets" "invites" "cleanup")

print_header() {
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}          HEIMDALL API TEST SUITE${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo
    if [ "$PAUSE_AFTER_TEST" = true ] || [ "$ECHO_CURL" = true ]; then
        echo -e "${YELLOW}Active Options:${NC}"
        [ "$PAUSE_AFTER_TEST" = true ] && echo -e "${GREEN}  ⏸️  Pause after each test enabled${NC}"
        [ "$ECHO_CURL" = true ] && echo -e "${GREEN}  🔧 Echo curl commands enabled${NC}"
        echo
    fi
}

print_menu() {
    echo -e "${YELLOW}Available Test Suites:${NC}"
    echo
    local i=1
    # Use ordered array for consistent numbering
    for key in "${TEST_ORDER[@]}"; do
        if [ "$key" != "cleanup" ]; then
            echo -e "${GREEN}$i)${NC} ${TEST_SCRIPTS[$key]} (test-$key.sh)"
            ((i++))
        fi
    done
    echo -e "${GREEN}$i)${NC} ${TEST_SCRIPTS["cleanup"]} (cleanup-test-data.sh)"
    echo -e "${GREEN}$((i+1)))${NC} Run All Tests (Sequential)"
    echo -e "${GREEN}$((i+2)))${NC} Run All Tests (Parallel - Fast)"
    echo -e "${GREEN}$((i+3)))${NC} Run All Tests + Auto Cleanup"
    echo -e "${GREEN}$((i+4)))${NC} Run Tests with Data Reuse (Recommended)"
    echo -e "${RED}0)${NC} Exit"
    echo
    echo -e "${YELLOW}💡 Tip: Option $((i+4)) runs auth once, then reuses data for other tests${NC}"
    echo
}

run_test_script() {
    local script_name="$1"
    local script_path=""
    
    # Handle special case for cleanup script
    if [ "$script_name" = "cleanup" ]; then
        script_path="$SCRIPT_DIR/cleanup-test-data.sh"
    else
        script_path="$SCRIPT_DIR/test-$script_name.sh"
    fi
    
    if [ ! -f "$script_path" ]; then
        echo -e "${RED}Error: Script '$script_path' not found!${NC}"
        return 1
    fi
    
    if [ ! -x "$script_path" ]; then
        echo -e "${YELLOW}Making script executable: $script_path${NC}"
        chmod +x "$script_path"
    fi
    
    echo -e "${BLUE}Running: ${TEST_SCRIPTS[$script_name]}${NC}"
    echo -e "${BLUE}Script: $script_path${NC}"
    echo
    
    # Run the script with the same arguments passed to this script
    "$script_path" $ORIGINAL_ARGS
    local exit_code=$?
    
    echo
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ ${TEST_SCRIPTS[$script_name]} completed successfully${NC}"
    else
        echo -e "${RED}✗ ${TEST_SCRIPTS[$script_name]} failed with exit code $exit_code${NC}"
    fi
    echo
    
    return $exit_code
}

run_all_tests_sequential() {
    echo -e "${PURPLE}Running all tests sequentially...${NC}"
    echo
    
    local total_passed=0
    local total_failed=0
    local failed_suites=()
    
    # Run tests in dependency order (exclude cleanup)
    local test_order=("auth" "organizations" "folders" "secrets" "invites")
    
    for test_name in "${test_order[@]}"; do
        if run_test_script "$test_name"; then
            ((total_passed++))
        else
            ((total_failed++))
            failed_suites+=("$test_name")
        fi
        
        # Add separator between test suites
        echo -e "${CYAN}----------------------------------------${NC}"
        echo
    done
    
    # Print summary
    echo -e "${PURPLE}=== FINAL SUMMARY ===${NC}"
    echo -e "${GREEN}Passed test suites: $total_passed${NC}"
    echo -e "${RED}Failed test suites: $total_failed${NC}"
    
    if [ ${#failed_suites[@]} -gt 0 ]; then
        echo -e "${RED}Failed suites: ${failed_suites[*]}${NC}"
        return 1
    else
        echo -e "${GREEN}All test suites passed!${NC}"
        return 0
    fi
}

run_all_tests_parallel() {
    echo -e "${PURPLE}Running all tests in parallel (faster but may cause conflicts)...${NC}"
    echo -e "${YELLOW}Warning: Parallel execution may cause database conflicts between tests${NC}"
    echo
    
    local pids=()
    local test_results=()
    
    # Start all tests in background (exclude cleanup from parallel execution)
    for test_name in "${!TEST_SCRIPTS[@]}"; do
        if [ "$test_name" != "cleanup" ]; then
            echo -e "${BLUE}Starting: ${TEST_SCRIPTS[$test_name]}${NC}"
            run_test_script "$test_name" &
            pids+=($!)
            test_results+=("$test_name")
        fi
    done
    
    echo
    echo -e "${YELLOW}Waiting for all tests to complete...${NC}"
    
    # Wait for all processes and collect results
    local total_passed=0
    local total_failed=0
    local failed_suites=()
    
    for i in "${!pids[@]}"; do
        local pid=${pids[$i]}
        local test_name=${test_results[$i]}
        
        if wait $pid; then
            echo -e "${GREEN}✓ ${TEST_SCRIPTS[$test_name]} completed${NC}"
            ((total_passed++))
        else
            echo -e "${RED}✗ ${TEST_SCRIPTS[$test_name]} failed${NC}"
            ((total_failed++))
            failed_suites+=("$test_name")
        fi
    done
    
    echo
    echo -e "${PURPLE}=== FINAL SUMMARY ===${NC}"
    echo -e "${GREEN}Passed test suites: $total_passed${NC}"
    echo -e "${RED}Failed test suites: $total_failed${NC}"
    
    if [ ${#failed_suites[@]} -gt 0 ]; then
        echo -e "${RED}Failed suites: ${failed_suites[*]}${NC}"
        return 1
    else
        echo -e "${GREEN}All test suites passed!${NC}"
        return 0
    fi
}

run_all_tests_with_cleanup() {
    echo -e "${PURPLE}Running all tests sequentially with automatic cleanup...${NC}"
    echo
    
    if run_all_tests_sequential; then
        echo -e "${BLUE}Running automatic cleanup...${NC}"
        run_test_script "cleanup"
        return $?
    else
        echo -e "${YELLOW}Tests failed, but running cleanup anyway...${NC}"
        run_test_script "cleanup"
        return 1
    fi
}

run_tests_with_data_reuse() {
    echo -e "${PURPLE}Running tests with optimized data reuse...${NC}"
    echo -e "${YELLOW}This approach minimizes user/organization creation by reusing test data${NC}"
    echo
    
    local total_passed=0
    local total_failed=0
    local failed_suites=()
    
    # Step 1: Run auth tests to set up base users and admin token
    echo -e "${BLUE}📋 Step 1: Setting up authentication and base users...${NC}"
    if run_test_script "auth"; then
        ((total_passed++))
        echo -e "${GREEN}✓ Base authentication setup complete${NC}"
    else
        ((total_failed++))
        failed_suites+=("auth")
        echo -e "${RED}✗ Authentication setup failed - continuing anyway${NC}"
    fi
    echo
    
    # Step 2: Check if we have the admin token needed for other tests
    if [ ! -f "/tmp/admin_token" ]; then
        echo -e "${YELLOW}⚠️  No admin token found. Some tests may fail.${NC}"
        echo -e "${YELLOW}   Creating minimal admin setup...${NC}"
        
        # Try to create admin user directly if auth tests failed
        local admin_data='{"email":"admin@gmail.com","username":"admin","password":"admin","firstName":"Admin","lastName":"User"}'
        local admin_response=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d "$admin_data" 2>/dev/null)
        
        if echo "$admin_response" | jq -e '.token' > /dev/null 2>&1; then
            echo "$admin_response" | jq -r '.token' > /tmp/admin_token
            echo -e "${GREEN}✓ Emergency admin setup successful${NC}"
        else
            # Try to login if user already exists
            local login_data='{"identifier":"admin@gmail.com","password":"admin"}'
            local login_response=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d "$login_data" 2>/dev/null)
            
            if echo "$login_response" | jq -e '.token' > /dev/null 2>&1; then
                echo "$login_response" | jq -r '.token' > /tmp/admin_token
                echo -e "${GREEN}✓ Admin login successful${NC}"
            else
                echo -e "${RED}✗ Could not establish admin access${NC}"
            fi
        fi
        echo
    fi
    
    # Step 3: Run other tests that will reuse existing data
    echo -e "${BLUE}📋 Step 2: Running API tests with data reuse...${NC}"
    local test_order=("organizations" "folders" "secrets" "invites")
    
    for test_name in "${test_order[@]}"; do
        echo -e "${CYAN}🔄 Running ${TEST_SCRIPTS[$test_name]}...${NC}"
        echo -e "${YELLOW}   (Will reuse existing users and create minimal new data)${NC}"
        
        if run_test_script "$test_name"; then
            ((total_passed++))
            echo -e "${GREEN}✓ ${TEST_SCRIPTS[$test_name]} completed with data reuse${NC}"
        else
            ((total_failed++))
            failed_suites+=("$test_name")
            echo -e "${RED}✗ ${TEST_SCRIPTS[$test_name]} failed${NC}"
        fi
        
        echo -e "${CYAN}----------------------------------------${NC}"
        echo
    done
    
    # Print summary
    echo -e "${PURPLE}=== OPTIMIZED TEST SUMMARY ===${NC}"
    echo -e "${GREEN}Passed test suites: $total_passed${NC}"
    echo -e "${RED}Failed test suites: $total_failed${NC}"
    echo -e "${BLUE}Data efficiency: Reused base users across all test suites${NC}"
    
    if [ ${#failed_suites[@]} -gt 0 ]; then
        echo -e "${RED}Failed suites: ${failed_suites[*]}${NC}"
        return 1
    else
        echo -e "${GREEN}All test suites passed with optimized data usage!${NC}"
        return 0
    fi
}

check_dependencies() {
    local missing_deps=()
    
    # Check for required commands
    for cmd in curl jq; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo -e "${RED}Error: Missing required dependencies: ${missing_deps[*]}${NC}"
        echo -e "${YELLOW}Please install the missing dependencies and try again.${NC}"
        echo
        echo "On Ubuntu/Debian: sudo apt-get install curl jq"
        echo "On CentOS/RHEL: sudo yum install curl jq"
        echo "On macOS: brew install curl jq"
        echo
        return 1
    fi
    
    return 0
}

main() {
    # Parse arguments for display purposes
    local PAUSE_AFTER_TEST=false
    local ECHO_CURL=false
    local SHOW_HELP=false
    
    for arg in $ORIGINAL_ARGS; do
        case $arg in
            --pause|-p)
                PAUSE_AFTER_TEST=true
                ;;
            --echo-curl|-e)
                ECHO_CURL=true
                ;;
            --help|-h)
                SHOW_HELP=true
                ;;
        esac
    done
    
    if [ "$SHOW_HELP" = true ]; then
        echo "Usage: $0 [OPTIONS]"
        echo "Options:"
        echo "  --pause, -p      Pause after each test and wait for user input"
        echo "  --echo-curl, -e  Echo the curl commands being executed"
        echo "  --help, -h       Show this help message"
        echo
        echo "Examples:"
        echo "  $0                    # Run normally"
        echo "  $0 --pause           # Pause after each test"
        echo "  $0 --echo-curl       # Show curl commands"
        echo "  $0 -p -e             # Both pause and echo curl"
        echo
        exit 0
    fi
    
    print_header
    
    # Check dependencies
    if ! check_dependencies; then
        exit 1
    fi
    
    # Check if server is running
    if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Cannot connect to server at $BASE_URL${NC}"
        echo -e "${YELLOW}Make sure the Heimdall server is running before executing tests.${NC}"
        echo
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Exiting..."
            exit 1
        fi
        echo
    fi
    
    while true; do
        print_menu
        read -p "Select an option (0-$((${#TEST_ORDER[@]} + 4))): " choice
        echo
        
        case $choice in
            0)
                echo -e "${CYAN}Goodbye!${NC}"
                break
                ;;
            $((${#TEST_ORDER[@]})))
                run_all_tests_sequential
                ;;
            $((${#TEST_ORDER[@]} + 1)))
                run_all_tests_parallel
                ;;
            $((${#TEST_ORDER[@]} + 2)))
                run_all_tests_with_cleanup
                ;;
            $((${#TEST_ORDER[@]} + 3)))
                run_tests_with_data_reuse
                ;;
            *)
                # Check if choice is valid for individual test
                local i=1
                local found=false
                local selected_test=""
                
                # Find the test script based on menu position
                for key in "${TEST_ORDER[@]}"; do
                    if [ "$choice" = "$i" ]; then
                        selected_test="$key"
                        found=true
                        break
                    fi
                    ((i++))
                done
                
                if [ "$found" = true ]; then
                    # Special handling for individual tests
                    if [ "$selected_test" != "auth" ] && [ "$selected_test" != "cleanup" ]; then
                        echo -e "${YELLOW}💡 Running individual test: ${TEST_SCRIPTS[$selected_test]}${NC}"
                        echo -e "${YELLOW}   Note: This test may create its own test data${NC}"
                        echo -e "${YELLOW}   For better efficiency, consider using 'Run Tests with Data Reuse'${NC}"
                        echo
                    fi
                    run_test_script "$selected_test"
                else
                    echo -e "${RED}Invalid choice. Please try again.${NC}"
                    echo
                fi
                ;;
        esac
        
        if [ "$choice" != "0" ]; then
            echo
            read -p "Press Enter to continue..."
            echo
        fi
    done
}

# Load configuration for BASE_URL
if [ -f "$SCRIPT_DIR/test-config.json" ]; then
    BASE_URL=$(jq -r '.baseUrl' "$SCRIPT_DIR/test-config.json")
else
    BASE_URL="http://localhost:3001/api"
fi

# Export BASE_URL for test scripts
export BASE_URL

# Run main function
main "$@"
