# Security Policy

## 🔒 Security Best Practices

This document outlines security considerations and best practices for deploying and maintaining this Discord bot.

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **Email**: Send details to the repository owner (check GitHub profile)
2. **Private Security Advisory**: Use GitHub's private vulnerability reporting feature

### What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if you have one)

We will respond to your report within **48 hours** and provide regular updates on our progress.

## Security Measures Implemented

### 1. **Credential Management**

✅ **What we do:**
- All sensitive credentials stored in environment variables
- `.env` file excluded from version control
- `.env.example` provided as a template (without real values)
- Configuration validation on startup

🚫 **Never:**
- Hardcode tokens, passwords, or API keys in code
- Commit `.env` files to version control
- Share your bot token publicly
- Use the same credentials across environments

### 2. **Input Validation & Sanitization**

✅ **Implemented:**
- All user inputs validated before processing
- SQL injection protection via parameterized queries
- Table and column name validation
- Discord ID validation
- URL validation
- Filename sanitization

### 3. **Database Security**

✅ **Implemented:**
- Parameterized queries (prepared statements)
- Input validation for all database operations
- Connection pooling with limits
- SSL/TLS support for database connections
- Query timeout protection
- Safe error messages (no information disclosure)

**Recommended:**
- Use strong database passwords
- Enable SSL/TLS in production (`SERVER_POSTGRES_SSL=true`)
- Restrict database user permissions
- Regular database backups
- Network isolation for database server

### 4. **Error Handling**

✅ **Implemented:**
- Stack traces hidden in production mode  
- Sanitized error messages for users
- Detailed errors only in development
- Error logging to secure channels
- Crash loop prevention (max 5 crashes/minute)

### 5. **Authentication & Authorization**

✅ **Implemented:**
- Developer/owner role system
- Permission checks before command execution
- Command cooldowns to prevent abuse
- Guild-based permission checking

**Best Practices:**
- Limit developer IDs to trusted users only
- Regularly review developer access
- Use Discord's permission system appropriately
- Implement additional rate limiting if needed

### 6. **Logging & Monitoring**

✅ **Implemented:**
- Sensitive data sanitization in logs
- Discord webhook logging
- Debug mode for development
- Production-safe logging

**Recommended:**
- Monitor logs regularly
- Set up alerts for critical errors
- Log command usage for auditing
- Rotate log files

## Production Deployment Security

### Environment Configuration

```env
# CRITICAL: Set to production
NODE_ENV=production

# Use strong, unique credentials
SERVER_POSTGRES_PASSWORD=strong_unique_password

# Enable SSL for database
SERVER_POSTGRES_SSL=true

# Disable debug logging
DB_DEBUG=false
```

### Deployment Checklist

- [ ] `NODE_ENV=production` is set
- [ ] All environment variables configured
- [ ] Database credentials are strong and unique
- [ ] SSL/TLS enabled for database connections
- [ ] `.env` file has restrictive permissions (`chmod 600 .env`)
- [ ] Bot token rotated if previously exposed
- [ ] Logging configured and monitored
- [ ] Process supervisor configured (PM2, systemd)
- [ ] Firewall rules configured
- [ ] Regular backups scheduled

### Network Security

**Recommended Practices:**
- Run bot behind a firewall
- Restrict database access to bot server only
- Use private network for database connections
- Keep systems updated with security patches
- Monitor network traffic for anomalies

## Dependency Security

### Keeping Dependencies Updated

Check for vulnerabilities:
```bash
npm audit
```

Fix vulnerabilities:
```bash
npm audit fix
```

**Best Practices:**
- Review `npm audit` output regularly
- Update dependencies monthly
- Test updates in development first
- Subscribe to security advisories for Discord.js and major dependencies

### Current Dependencies

Major dependencies and their security considerations:

- **discord.js**: Keep updated for security patches
- **pg (node-postgres)**: Critical for database security
- **dotenv**: Ensures environment variables loaded correctly
- **axios**: Used for HTTP requests (if applicable)

## Discord-Specific Security

### Bot Token Security

🚨 **If your bot token is exposed:**

 1. **Immediately** regenerate the token in Discord Developer Portal
2. Update the token in your `.env` file
3. Restart the bot
4. Review recent bot activity for suspicious actions
5. Investigate how the token was exposed

### Bot Permissions

**Principle of Least Privilege:**
- Only request permissions the bot actually needs
- Avoid `Administrator` permission unless absolutely necessary
- Review and document why each permission is needed
- Use role-based permissions when possible

### Recommended Permissions

```
Minimal Required:
- View Channels
- Send Messages
- Embed Links
- Read Message History
- Use Application Commands

Additional (as needed):
- Manage Messages (for moderation features)
- Manage Roles (for auto-role features)
- etc.
```

## Code Security Guidelines

### For Contributors

When contributing code:

1. **Never commit sensitive data**
   - No tokens, passwords, or API keys
   - No real user data or IDs
   - No internal URLs or IP addresses

2. **Validate all inputs**
   - Use validation utilities (`Src/Functions/validation.js`)
   - Never trust user input
   - Sanitize before database operations

3. **Use parameterized queries**
   - Never concatenate SQL strings
   - Use the database module's methods
   - Validate table/column names

4. **Handle errors safely**
   - Don't leak sensitive information
   - Use `sanitizeErrorMessage()` for user-facing errors
   - Log full errors securely

5. **Follow security best practices**
   - Keep dependencies updated
   - Review code for vulnerabilities
   - Test security features thoroughly

## Common Vulnerabilities & Mitigations

### SQL Injection

❌ **Vulnerable:**
```javascript
await db.rawQuery(`SELECT * FROM users WHERE id = ${userId}`);
```

✅ **Secure:**
```javascript
await db.rawQuery('SELECT * FROM users WHERE id = $1', [userId]);
```

### Information Disclosure

❌ **Vulnerable:**
```javascript
await interaction.reply({ content: error.stack });
```

✅ **Secure:**
```javascript
await interaction.reply({ content: sanitizeErrorMessage(error) });
```

### Command Injection

❌ **Vulnerable:**
```javascript
exec(`ffmpeg -i ${userInput}.mp3`);
```

✅ **Secure:**
```javascript
// Validate input first
const safe = sanitizeFilename(userInput);
// Or better: avoid shell commands with user input
```

## Incident Response

If you discover a security incident:

1. **Contain**: Immediately stop the bot if necessary
2. **Assess**: Determine the scope and impact
3. **Notify**: Report to repository maintainers
4. **Document**: Record what happened and when
5. **Recover**: Fix the vulnerability and restore service
6. **Review**: Update security measures to prevent recurrence

## Security Updates

We will:
- Release security patches promptly
- Notify users of security updates via GitHub releases
- Provide migration guides for breaking security changes
- Maintain this security policy

## Additional Resources

- [Discord Developer Terms of Service](https://discord.com/developers/docs/policies-and-agreements/terms-of-service)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html)

---

**Last Updated**: January 2026

**Questions?** Open an issue or discussion on GitHub.
