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
)

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
    for key in "${!TEST_SCRIPTS[@]}"; do
        echo -e "${GREEN}$i)${NC} ${TEST_SCRIPTS[$key]} (test-$key.sh)"
        ((i++))
    done
    echo -e "${GREEN}$i)${NC} Run All Tests (Sequential)"
    echo -e "${GREEN}$((i+1)))${NC} Run All Tests (Parallel - Fast)"
    echo -e "${RED}0)${NC} Exit"
    echo
}

run_test_script() {
    local script_name="$1"
    local script_path="$SCRIPT_DIR/test-$script_name.sh"
    
    if [ ! -f "$script_path" ]; then
        echo -e "${RED}Error: Test script '$script_path' not found!${NC}"
        return 1
    fi
    
    if [ ! -x "$script_path" ]; then
        echo -e "${YELLOW}Making script executable: $script_path${NC}"
        chmod +x "$script_path"
    fi
    
    echo -e "${BLUE}Running: ${TEST_SCRIPTS[$script_name]}${NC}"
    echo -e "${BLUE}Script: $script_path${NC}"
    echo
    
    # Run the test script with the same arguments passed to this script
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
    
    # Run tests in dependency order
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
    
    # Start all tests in background
    for test_name in "${!TEST_SCRIPTS[@]}"; do
        echo -e "${BLUE}Starting: ${TEST_SCRIPTS[$test_name]}${NC}"
        run_test_script "$test_name" &
        pids+=($!)
        test_results+=("$test_name")
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
        read -p "Select an option (0-$((${#TEST_SCRIPTS[@]} + 2))): " choice
        echo
        
        case $choice in
            0)
                echo -e "${CYAN}Goodbye!${NC}"
                break
                ;;
            $((${#TEST_SCRIPTS[@]} + 1)))
                run_all_tests_sequential
                ;;
            $((${#TEST_SCRIPTS[@]} + 2)))
                run_all_tests_parallel
                ;;
            *)
                # Check if choice is valid for individual test
                local i=1
                local found=false
                for key in "${!TEST_SCRIPTS[@]}"; do
                    if [ "$choice" = "$i" ]; then
                        run_test_script "$key"
                        found=true
                        break
                    fi
                    ((i++))
                done
                
                if [ "$found" = false ]; then
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
