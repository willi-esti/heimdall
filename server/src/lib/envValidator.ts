import { logger } from './logger';

// Environment variable configuration with validation rules
interface EnvVariable {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'jwt' | 'port' | 'duration' | 'log_level' | 'node_env';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowedValues?: string[];
  defaultValue?: string;
  sensitive?: boolean; // For masking in logs
  description: string;
}

const ENV_CONFIG: EnvVariable[] = [
  // Database Configuration
  {
    name: 'DATABASE_URL',
    required: true,
    type: 'url',
    pattern: /^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^?]+(\?.*)?$/,
    description: 'PostgreSQL connection string with format: postgresql://user:password@host:port/database'
  },
  {
    name: 'POSTGRES_USER',
    required: true,
    type: 'string',
    minLength: 3,
    maxLength: 63,
    description: 'PostgreSQL username'
  },
  {
    name: 'POSTGRES_PASSWORD',
    required: true,
    type: 'string',
    minLength: 6,
    sensitive: true,
    description: 'PostgreSQL password (minimum 6 characters)'
  },
  {
    name: 'POSTGRES_DB',
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 63,
    pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
    description: 'PostgreSQL database name (alphanumeric and underscores only)'
  },

  // JWT Configuration
  {
    name: 'JWT_SECRET',
    required: true,
    type: 'jwt',
    minLength: 32,
    sensitive: true,
    description: 'JWT signing secret (minimum 32 characters for security)'
  },
  {
    name: 'JWT_EXPIRES_IN',
    required: true,
    type: 'duration',
    pattern: /^(\d+[smhdwy]|\d+)$/,
    defaultValue: '7d',
    description: 'JWT expiration time (e.g., 1h, 7d, 30m)'
  },

  // Encryption Configuration
  {
    name: 'ENCRYPTION_KEY',
    required: true,
    type: 'string',
    minLength: 32,
    sensitive: true,
    description: 'AES-256 encryption key (minimum 32 characters)'
  },

  // Server Configuration
  {
    name: 'HOST',
    required: false,
    type: 'string',
    defaultValue: '0.0.0.0',
    pattern: /^(\d{1,3}\.){3}\d{1,3}$|^localhost$|^0\.0\.0\.0$/,
    description: 'Server host address (IP address, localhost, or 0.0.0.0)'
  },
  {
    name: 'PORT',
    required: false,
    type: 'port',
    defaultValue: '3000',
    description: 'Server port number (1-65535)'
  },
  {
    name: 'NODE_ENV',
    required: false,
    type: 'node_env',
    allowedValues: ['development', 'production', 'test'],
    defaultValue: 'development',
    description: 'Node.js environment mode'
  },

  // CORS Configuration
  {
    name: 'CORS_ORIGINS',
    required: false,
    type: 'string',
    defaultValue: '',
    description: 'Comma-separated list of allowed CORS origins (leave empty for development)'
  },

  // Logging Configuration
  {
    name: 'LOG_LEVEL',
    required: false,
    type: 'log_level',
    allowedValues: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
    defaultValue: 'info',
    description: 'Logging level for Winston logger'
  },
  {
    name: 'LOG_MAX_SIZE',
    required: false,
    type: 'string',
    pattern: /^\d+[kmg]?b?$/i,
    defaultValue: '20m',
    description: 'Maximum log file size (e.g., 20m, 100k, 1g)'
  },
  {
    name: 'LOG_MAX_FILES',
    required: false,
    type: 'string',
    pattern: /^\d+[dw]?$/,
    defaultValue: '30d',
    description: 'Maximum log file retention (e.g., 30d, 4w, 10)'
  },
  {
    name: 'LOG_ERROR_MAX_FILES',
    required: false,
    type: 'string',
    pattern: /^\d+[dw]?$/,
    defaultValue: '14d',
    description: 'Maximum error log file retention (e.g., 14d, 2w, 7)'
  },
  {
    name: 'LOG_COMPRESSION',
    required: false,
    type: 'boolean',
    defaultValue: 'true',
    description: 'Enable gzip compression for rotated log files'
  }
];

class EnvValidationError extends Error {
  constructor(public errors: string[]) {
    super(`Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

class EnvironmentValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Validates all environment variables according to the configuration
   */
  public validateEnvironment(): { isValid: boolean; errors: string[]; warnings: string[] } {
    this.errors = [];
    this.warnings = [];

    logger.info('🔍 Validating environment variables...');

    for (const config of ENV_CONFIG) {
      this.validateVariable(config);
    }

    if (this.errors.length > 0) {
      logger.error('❌ Environment validation failed', {
        errors: this.errors,
        warnings: this.warnings,
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length
      });
    } else if (this.warnings.length > 0) {
      logger.warn('⚠️ Environment validation completed with warnings', {
        warnings: this.warnings,
        totalWarnings: this.warnings.length
      });
    } else {
      logger.info('✅ Environment validation passed successfully');
    }

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Validates a single environment variable
   */
  private validateVariable(config: EnvVariable): void {
    const value = process.env[config.name];
    const displayValue = config.sensitive ? '[REDACTED]' : value;

    // Check if required variable is missing
    if (config.required && (!value || value.trim() === '')) {
      this.errors.push(`${config.name} is required but not set. ${config.description}`);
      return;
    }

    // Set default value if not provided and not required
    if (!value && config.defaultValue) {
      process.env[config.name] = config.defaultValue;
      this.warnings.push(`${config.name} not set, using default: ${config.defaultValue}`);
      return;
    }

    // Skip validation if optional and not provided
    if (!config.required && !value) {
      return;
    }

    // Validate type
    if (!this.validateType(config, value!)) {
      return; // Error already added
    }

    // Validate length
    if (config.minLength && value!.length < config.minLength) {
      this.errors.push(`${config.name} must be at least ${config.minLength} characters long (current: ${value!.length})`);
    }

    if (config.maxLength && value!.length > config.maxLength) {
      this.errors.push(`${config.name} must not exceed ${config.maxLength} characters (current: ${value!.length})`);
    }

    // Validate pattern
    if (config.pattern && !config.pattern.test(value!)) {
      this.errors.push(`${config.name} format is invalid. ${config.description}`);
    }

    // Validate allowed values
    if (config.allowedValues && !config.allowedValues.includes(value!)) {
      this.errors.push(`${config.name} must be one of: ${config.allowedValues.join(', ')} (current: ${displayValue})`);
    }

    logger.debug(`✓ ${config.name}: ${displayValue}`);
  }

  /**
   * Validates the type of an environment variable
   */
  private validateType(config: EnvVariable, value: string): boolean {
    const displayValue = config.sensitive ? '[REDACTED]' : value;

    switch (config.type) {
      case 'string':
        return true; // All values are strings initially

      case 'number':
        if (isNaN(Number(value))) {
          this.errors.push(`${config.name} must be a valid number (current: ${displayValue})`);
          return false;
        }
        return true;

      case 'boolean':
        if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
          this.errors.push(`${config.name} must be true/false or 1/0 (current: ${displayValue})`);
          return false;
        }
        return true;

      case 'port':
        const port = parseInt(value);
        if (isNaN(port) || port < 1 || port > 65535) {
          this.errors.push(`${config.name} must be a valid port number (1-65535) (current: ${displayValue})`);
          return false;
        }
        return true;

      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          this.errors.push(`${config.name} must be a valid URL (current: ${displayValue})`);
          return false;
        }

      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
          this.errors.push(`${config.name} must be a valid email address (current: ${displayValue})`);
          return false;
        }
        return true;

      case 'jwt':
        if (value.length < 32) {
          this.errors.push(`${config.name} must be at least 32 characters for security`);
          return false;
        }
        return true;

      case 'duration':
        if (!/^(\d+[smhdwy]|\d+)$/.test(value)) {
          this.errors.push(`${config.name} must be a valid duration (e.g., 1h, 7d, 30m) (current: ${displayValue})`);
          return false;
        }
        return true;

      case 'log_level':
        return true; // Validated by allowedValues

      case 'node_env':
        return true; // Validated by allowedValues

      default:
        this.warnings.push(`Unknown type '${config.type}' for ${config.name}`);
        return true;
    }
  }

  /**
   * Validates environment and throws error if validation fails
   */
  public validateAndThrow(): void {
    const result = this.validateEnvironment();
    if (!result.isValid) {
      throw new EnvValidationError(result.errors);
    }
  }

  /**
   * Gets a summary of the current environment configuration
   */
  public getEnvironmentSummary(): object {
    const summary: any = {};
    
    for (const config of ENV_CONFIG) {
      const value = process.env[config.name];
      if (value) {
        summary[config.name] = config.sensitive ? '[REDACTED]' : value;
      } else if (config.defaultValue) {
        summary[config.name] = `${config.defaultValue} (default)`;
      } else {
        summary[config.name] = config.required ? '[MISSING - REQUIRED]' : '[NOT SET - OPTIONAL]';
      }
    }

    return summary;
  }
}

// Export singleton instance
export const envValidator = new EnvironmentValidator();
export { EnvValidationError };
