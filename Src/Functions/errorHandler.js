const { EmbedBuilder } = require('discord.js');

// Create a simple error embed
function createErrorEmbed(title, description, options = {}) {
  const embed = new EmbedBuilder()
    .setColor(options.color || '#ff0000')
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (options.footer) {
    embed.setFooter({ text: options.footer });
  }

  return embed;
}

// Main API error handler with specific embeds for each error
function handleApiError(error, featureName, action, context = {}) {
  const errorMsg = error.message?.toLowerCase() || '';
  const statusCode = error.statusCode || 0;
  const errorCode = error.code || '';

  // ============================================
  // AUTHENTICATION ERRORS (401)
  // ============================================
  if (statusCode === 401 || errorCode === 'InvalidCredentialsException') {
    return createErrorEmbed(
      '🔒 Invalid API Key',
      'Your API key is invalid or has expired. Re-link your panel using `/panel link`.',
      { color: '#ff6600' }
    );
  }

  // ============================================
  // PERMISSION ERRORS (403)
  // ============================================
  if (statusCode === 403 || errorCode === 'InsufficientPermissionsException') {
    return createErrorEmbed(
      '🔒 Permission Denied',
      'You don\'t have permission to perform this action. Contact your hosting provider or server owner.',
      { color: '#ff6600' }
    );
  }

  // ============================================
  // NOT FOUND ERRORS (404)
  // ============================================
  if (errorCode === 'UserNotFoundException') {
    return createErrorEmbed(
      '❌ User Not Found',
      'No user with that email address was found. Make sure the user has a Pterodactyl panel account.',
      { color: '#ff0000' }
    );
  }

  if (statusCode === 404 || errorCode === 'NotFoundHttpException') {
    return createErrorEmbed(
      '❌ Resource Not Found',
      'The requested resource could not be found. It may have been deleted or the ID is incorrect.',
      { color: '#ff0000' }
    );
  }

  if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
    return createErrorEmbed(
      '❌ Not Found',
      error.message || 'The requested resource could not be found.',
      { color: '#ff0000' }
    );
  }

  // ============================================
  // CONFLICT ERRORS (409)
  // ============================================
  if (errorCode === 'AllocationNotAvailableException') {
    return createErrorEmbed(
      '🌐 Allocation Unavailable',
      'The requested IP:Port allocation is not available or already in use. Try selecting a different port.',
      { color: '#ff9900' }
    );
  }

  if (errorCode === 'UserAlreadyHasAccessException') {
    return createErrorEmbed(
      '👥 User Already Added',
      'This user already has access to the server. You can update their permissions instead of adding them again.',
      { color: '#ff9900' }
    );
  }

  if (errorCode === 'ConflictingServerStateException') {
    return createErrorEmbed(
      '⚠️ Server Busy',
      'The server is currently processing another task. Wait for it to complete and try again.',
      { color: '#ff9900' }
    );
  }

  if (statusCode === 409) {
    return createErrorEmbed(
      '⚠️ Operation Conflict',
      error.message || 'This operation conflicts with the current server state.',
      { color: '#ff9900' }
    );
  }

  // ============================================
  // VALIDATION ERRORS (422)
  // ============================================
  if (statusCode === 422 || errorCode === 'ValidationException') {
    return createErrorEmbed(
      '⚠️ Validation Error',
      error.message + '\n\nCheck your input values and ensure all required fields are correct.',
      { color: '#ff9900' }
    );
  }

  // ============================================
  // RATE LIMIT ERRORS (429)
  // ============================================
  if (statusCode === 429) {
    return createErrorEmbed(
      '⏱️ Rate Limited',
      'Too many requests. Please wait a moment before trying again.',
      { color: '#ff9900' }
    );
  }

  // ============================================
  // SERVICE UNAVAILABLE (503)
  // ============================================
  if (statusCode === 503 || errorCode === 'NoAvailableAllocationsException') {
    return createErrorEmbed(
      '🌐 No Allocations Available',
      'There are no available IP:Port allocations on this node. Contact your hosting provider to add more ports.',
      { color: '#ff0000' }
    );
  }

  // ============================================
  // STORAGE ERRORS (507)
  // ============================================
  if (statusCode === 507 || errorCode === 'InsufficientStorageException') {
    return createErrorEmbed(
      '💾 Insufficient Storage',
      'Not enough storage space available. Delete old files or backups, or contact your provider to increase storage.',
      { color: '#ff0000' }
    );
  }

  if (errorMsg.includes('insufficient storage')) {
    return createErrorEmbed(
      '💾 Storage Full',
      'The server has run out of storage space. Delete old files or backups to free up space.',
      { color: '#ff0000' }
    );
  }

  if (errorMsg.includes('not enough storage')) {
    return createErrorEmbed(
      '💾 Storage Limit Exceeded',
      'There is not enough storage space to complete this operation. Contact your hosting provider.',
      { color: '#ff0000' }
    );
  }

  // ============================================
  // SERVER ERRORS (500+)
  // ============================================
  if (statusCode >= 500) {
    return createErrorEmbed(
      '🔥 Panel Server Error',
      'The panel server encountered an internal error. This is not a bot issue. Try again later or contact your hosting provider.',
      { color: '#ff0000', footer: 'This is a panel error, not a bot issue' }
    );
  }

  // ============================================
  // BACKUP ERRORS
  // ============================================
  if (errorCode === 'TooManyBackupsException') {
    return createErrorEmbed(
      '💾 Backup Limit Reached',
      'You\'ve reached the maximum number of backups allowed for this server. Delete old backups or upgrade your plan.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('backup limit')) {
    return createErrorEmbed(
      '💾 Too Many Backups',
      'Maximum backup limit reached. Delete some old backups to create new ones.',
      { color: '#ff9900' }
    );
  }

  if (errorCode === 'BackupIsLockedException') {
    return createErrorEmbed(
      '🔒 Backup Locked',
      'This backup is locked and cannot be deleted. Unlock it first using `/backup lock` before attempting to delete it.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('backup is locked')) {
    return createErrorEmbed(
      '🔒 Locked Backup',
      'This backup is protected and cannot be modified or deleted. Unlock it first.',
      { color: '#ff9900' }
    );
  }

  if (errorCode === 'BackupNotCompletedException') {
    return createErrorEmbed(
      '⏳ Backup In Progress',
      'This backup is still being created. Wait for it to complete before attempting to download or restore it.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('backup not completed')) {
    return createErrorEmbed(
      '⏳ Backup Not Ready',
      'The backup hasn\'t finished yet. Please wait for it to complete.',
      { color: '#ff9900' }
    );
  }

  if (errorCode === 'BackupFailedException') {
    return createErrorEmbed(
      '❌ Backup Failed',
      'The backup creation failed. Try creating a new backup or contact your hosting provider if the issue persists.',
      { color: '#ff0000' }
    );
  }

  if (errorMsg.includes('backup failed')) {
    return createErrorEmbed(
      '❌ Backup Error',
      'The backup operation failed to complete successfully. Try again or contact support.',
      { color: '#ff0000' }
    );
  }

  if (errorMsg.includes('another backup is in progress')) {
    return createErrorEmbed(
      '⏳ Backup Already Running',
      'Another backup is currently being created. Wait for it to finish before starting a new one.',
      { color: '#ff9900' }
    );
  }

  // ============================================
  // ALLOCATION ERRORS
  // ============================================
  if (errorCode === 'TooManyAllocationsException') {
    return createErrorEmbed(
      '🌐 Allocation Limit Reached',
      'You\'ve reached the maximum number of IP:Port allocations. Remove unused allocations or upgrade your plan.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('allocation limit')) {
    return createErrorEmbed(
      '🌐 Too Many Allocations',
      'Maximum allocation limit reached. Remove some unused ports to add new ones.',
      { color: '#ff9900' }
    );
  }

  if (errorCode === 'CannotDeletePrimaryAllocationException') {
    return createErrorEmbed(
      '🚫 Cannot Delete Primary Allocation',
      'You cannot delete the primary allocation. Set another allocation as primary first, then delete this one.',
      { color: '#ff0000' }
    );
  }

  if (errorMsg.includes('cannot delete primary')) {
    return createErrorEmbed(
      '🚫 Primary Allocation Protected',
      'The primary allocation cannot be removed. Assign a different allocation as primary first.',
      { color: '#ff0000' }
    );
  }

  // ============================================
  // SCHEDULE ERRORS
  // ============================================
  if (errorCode === 'TooManySchedulesException') {
    return createErrorEmbed(
      '📅 Schedule Limit Reached',
      'You\'ve reached the maximum number of schedules. Delete unused schedules or upgrade your plan.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('schedule limit')) {
    return createErrorEmbed(
      '📅 Too Many Schedules',
      'Maximum schedule limit reached. Remove some old or unused schedules.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('invalid cron')) {
    return createErrorEmbed(
      '⚠️ Invalid Cron Expression',
      'The cron expression you provided is invalid. Check the syntax and try again.\n\nExample: `0 3 * * *` (daily at 3 AM)',
      { color: '#ff9900' }
    );
  }

  // ============================================
  // USER/SUBUSER ERRORS
  // ============================================
  if (errorCode === 'TooManySubusersException') {
    return createErrorEmbed(
      '👥 Subuser Limit Reached',
      'You\'ve reached the maximum number of subusers. Remove inactive users or upgrade your plan.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('subuser limit')) {
    return createErrorEmbed(
      '👥 Too Many Subusers',
      'Maximum subuser limit reached. Remove some users to add new ones.',
      { color: '#ff9900' }
    );
  }

  if (errorCode === 'CannotRemoveServerOwnerException') {
    return createErrorEmbed(
      '🚫 Cannot Remove Owner',
      'You cannot remove the server owner from the server. Only subusers can be removed.',
      { color: '#ff0000' }
    );
  }

  // ============================================
  // DATABASE ERRORS
  // ============================================
  if (errorMsg.includes('database limit')) {
    return createErrorEmbed(
      '🗄️ Database Limit Reached',
      'You\'ve reached the maximum number of databases. Delete unused databases or upgrade your plan.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('max databases')) {
    return createErrorEmbed(
      '🗄️ Maximum Databases',
      'No more databases can be created. Remove old databases or contact your provider.',
      { color: '#ff9900' }
    );
  }

  // ============================================
  // SERVER STATE ERRORS
  // ============================================
  if (errorMsg.includes('must be stopped')) {
    return createErrorEmbed(
      '⚠️ Server Must Be Stopped',
      'This action requires the server to be offline. Stop the server using `/server stop` and try again.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('must be offline')) {
    return createErrorEmbed(
      '⚠️ Server Must Be Offline',
      'The server needs to be stopped before you can perform this action. Use `/server stop` first.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('server must be stopped')) {
    return createErrorEmbed(
      '⚠️ Stop Server Required',
      'Please stop the server before attempting this operation.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('must be running')) {
    return createErrorEmbed(
      '⚠️ Server Must Be Running',
      'This action requires the server to be online. Start the server using `/server start` and try again.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('must be online')) {
    return createErrorEmbed(
      '⚠️ Server Must Be Online',
      'The server needs to be running before you can perform this action. Use `/server start` first.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('installing')) {
    return createErrorEmbed(
      '⏳ Server Installing',
      'The server is currently being installed. Please wait for the installation to complete before performing any actions.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('server is installing')) {
    return createErrorEmbed(
      '⏳ Installation In Progress',
      'Server installation is still in progress. Wait for it to finish.',
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('suspended')) {
    return createErrorEmbed(
      '🚫 Server Suspended',
      'This server has been suspended by your hosting provider. Contact them immediately to resolve this issue.',
      { color: '#ff0000', footer: 'Contact your hosting provider to resolve suspension' }
    );
  }

  if (errorMsg.includes('server is suspended')) {
    return createErrorEmbed(
      '🚫 Account Suspended',
      'Your server is currently suspended. Please contact your hosting provider to restore access.',
      { color: '#ff0000', footer: 'Contact support immediately' }
    );
  }

  if (errorMsg.includes('server is busy')) {
    return createErrorEmbed(
      '⚠️ Server Processing',
      'The server is currently busy processing another task. Please wait a moment and try again.',
      { color: '#ff9900' }
    );
  }

  // ============================================
  // GENERIC REQUEST ERRORS
  // ============================================
  if (errorCode === 'BadRequestHttpException') {
    return createErrorEmbed(
      '⚠️ Invalid Request',
      error.message + '\n\nCheck your input for typos or invalid characters.',
      { color: '#ff9900' }
    );
  }

  // ============================================
  // GENERIC LIMIT ERRORS
  // ============================================
  if (errorMsg.includes('limit')) {
    return createErrorEmbed(
      '⚠️ Limit Reached',
      `You've reached the maximum ${featureName.toLowerCase()} limit. Contact your provider or upgrade your plan.`,
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('maximum')) {
    return createErrorEmbed(
      '⚠️ Maximum Exceeded',
      `Maximum ${featureName.toLowerCase()} limit has been reached. Remove old items or upgrade your plan.`,
      { color: '#ff9900' }
    );
  }

  if (errorMsg.includes('quota')) {
    return createErrorEmbed(
      '⚠️ Quota Exceeded',
      `Your ${featureName.toLowerCase()} quota has been exceeded. Contact your provider for more resources.`,
      { color: '#ff9900' }
    );
  }

  // ============================================
  // GENERIC FALLBACK
  // ============================================
  return createErrorEmbed(
    `❌ ${featureName} Error`,
    error.message || 'An unexpected error occurred. Please try again.',
    { color: '#ff0000' }
  );
}

// Create a simple success embed
function createSuccessEmbed(title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

module.exports = {
  handleApiError,
  createErrorEmbed,
  createSuccessEmbed
};