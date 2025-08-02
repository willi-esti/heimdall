# Heimdall API Testing Framework

A comprehensive shell-based testing framework for the Heimdall API with curl and automated cleanup capabilities.

## Overview

This testing framework provides:
- **Individual test suites** for each API endpoint group
- **Master test runner** with interactive menu
- **Automated cleanup** of test data
- **Command-line options** for debugging and manual testing
- **Comprehensive error coverage** (200, 400, 401, 403, 404, 409, 500)

## Quick Start

```bash
cd /opt/heimdall/server/test

# Run all tests with cleanup
./run-tests.sh

# Select option 9: "Run All Tests + Auto Cleanup"
```

## Command-Line Options

All test scripts support these options:

### `--pause` or `-p`
Pause after each test and wait for Enter key
```bash
./test-auth.sh --pause
./run-tests.sh --pause
```

### `--echo-curl` or `-e`  
Display the exact curl commands being executed
```bash
./test-secrets.sh --echo-curl
./run-tests.sh --echo-curl
```

### `--help` or `-h`
Show usage information
```bash
./test-auth.sh --help
./run-tests.sh --help
```

### Combined Options
```bash
./test-organizations.sh --pause --echo-curl
./run-tests.sh -p -e
```

## Test Scripts

### Individual Test Suites

| Script | Purpose | Test Count |
|--------|---------|------------|
| `test-auth.sh` | Authentication endpoints | 19 tests |
| `test-organizations.sh` | Organization management | 33 tests |
| `test-folders.sh` | Folder hierarchy | 36 tests |
| `test-secrets.sh` | Secret management + version deletion | 40 tests |
| `test-invites.sh` | Organization invitations | 39 tests |

### Master Test Runner

`run-tests.sh` - Interactive menu with options:

1. **Individual Test Suites** - Run specific test scripts
2. **Run All Tests (Sequential)** - Run all tests in dependency order
3. **Run All Tests (Parallel)** - Run tests simultaneously (faster but may conflict)
4. **Run All Tests + Auto Cleanup** - Run all tests then automatically clean up
5. **Cleanup Test Data** - Clean up test organizations and temporary files

## Test Data Cleanup

### Manual Cleanup
```bash
./cleanup-test-data.sh
```

### Automatic Cleanup
The cleanup script removes:
- ✅ Temporary token files (`/tmp/admin_token`, etc.)
- ✅ Test organizations (identified by name patterns)
- ✅ Associated folders, secrets, and invitations (cascade delete)
- ⚠️ Test users (require manual review - listed in output)

### Test Data Patterns
The cleanup script identifies test data by these patterns:
- Organizations containing: "Test", "Demo", "Folder Test", "Secret Test", "Invite Test"
- Temporary files in `/tmp/` directory

## Configuration

### `test-config.json`
```json
{
  "baseUrl": "http://localhost:3001/api",
  "fixedData": {
    "user": {
      "email": "admin@gmail.com",
      "username": "admin", 
      "password": "admin",
      "firstName": "Admin",
      "lastName": "User"
    }
  }
}
```

## Usage Examples

### Debug a Specific Test
```bash
# Run with curl echo and pausing
./test-secrets.sh --echo-curl --pause

# Copy the displayed curl command and run manually
curl -X POST \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Test Secret", "value": "secret123"}' \
  'http://localhost:3001/api/secrets'
```

### Run Complete Test Suite
```bash
# Run all tests with automatic cleanup
./run-tests.sh
# Select option 9

# Or run individual suites in order
./test-auth.sh
./test-organizations.sh  
./test-folders.sh
./test-secrets.sh
./test-invites.sh
./cleanup-test-data.sh
```

### Continuous Integration
```bash
# Run all tests and cleanup in one command
./run-tests.sh <<< "9"

# Check exit code
if [ $? -eq 0 ]; then
    echo "All tests passed!"
else
    echo "Some tests failed"
fi
```

## Test Dependencies

### Prerequisites
- `curl` - HTTP client for API requests
- `jq` - JSON parser for response handling
- `bash` - Shell interpreter (version 4+)

### Installation
```bash
# Ubuntu/Debian
sudo apt-get install curl jq

# CentOS/RHEL  
sudo yum install curl jq

# macOS
brew install curl jq
```

### Server Requirements
- Heimdall server running on configured URL (default: `localhost:3001`)
- Database with admin user (email: admin@gmail.com, password: admin)

## Test Results

### Example Output
```
🧪 Test: Create Secret - Valid Data
----------------------------------------
🔧 Curl Command:
curl -X POST \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Test Secret", "value": "secret123"}' \
  'http://localhost:3001/api/secrets'

✅ Create secret - Status: 201
{
  "message": "Secret created successfully",
  "secret": {
    "id": "cm123...",
    "name": "Test Secret",
    "currentVersion": 1
  }
}

⏸️  Press Enter to continue to next test...
```

### Test Summary
```
📊 TEST RESULTS SUMMARY
========================================
Total Tests: 40
Passed: 38
Failed: 2
❌ 2 tests failed
```

## Troubleshooting

### Common Issues

1. **Server Not Running**
   ```
   Warning: Cannot connect to server at http://localhost:3001
   ```
   **Solution:** Start the Heimdall server before running tests

2. **Admin Token Not Found**
   ```
   Admin token not found. Please run auth tests first.
   ```
   **Solution:** Run `./test-auth.sh` first or use the master runner

3. **Test Data Conflicts** 
   ```
   Expected: 201, Got: 409 - Email already exists
   ```
   **Solution:** Run cleanup script: `./cleanup-test-data.sh`

4. **Permission Denied**
   ```
   bash: ./test-auth.sh: Permission denied
   ```
   **Solution:** Make scripts executable: `chmod +x *.sh`

### Debug Mode
```bash
# Enable bash debugging
bash -x ./test-auth.sh --echo-curl --pause

# Check individual curl commands
./test-secrets.sh --echo-curl | grep -A 10 "curl -X"
```

## Contributing

### Adding New Tests

1. **Create test function:**
   ```bash
   print_test_header "New Test - Description"
   make_request "POST" "/new-endpoint" "$DATA" "201" "$TOKEN" "Test description"
   ```

2. **Add to test script:**
   - Follow existing numbering pattern
   - Include error scenarios (400, 401, 403, 404, 409)
   - Test different user roles when applicable

3. **Update cleanup script:**
   - Add patterns for new test data identification
   - Include cascade deletion for related entities

### Best Practices

- ✅ Use descriptive test names
- ✅ Test both success and error scenarios  
- ✅ Include proper cleanup
- ✅ Follow existing code patterns
- ✅ Add pause points for complex operations
- ✅ Document new test scenarios

## Security Notes

- Test tokens are stored in `/tmp/` and cleaned up automatically
- Admin credentials are stored in config file (use secure values in production)
- Test data is isolated using predictable naming patterns
- Cleanup script only deletes test organizations (identified by name patterns)

---

**Need Help?** Run any script with `--help` for usage information.
