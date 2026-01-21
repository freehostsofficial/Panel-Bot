const { EmbedBuilder } = require('discord.js');

function isFeatureDisabledError(error) {
  const errorMessage = error.message?.toLowerCase() || '';
  const disabledKeywords = [
    'not authorized',
    'permission denied',
    'forbidden',
    'feature is disabled',
    'not allowed',
    'restricted',
    'insufficient permissions',
    'access denied',
    'disabled by administrator',
    'backup limit reached',
    'database limit reached'
  ];

  return disabledKeywords.some(keyword => errorMessage.includes(keyword));
}

function createFeatureDisabledEmbed(featureName, action) {
  return new EmbedBuilder()
    .setColor('#ff6600')
    .setTitle('🚫 Feature Restricted')
    .setDescription(`The **${featureName}** feature appears to be restricted on this panel.`)
    .addFields(
      {
        name: '❓ Why is this happening?',
        value: 'Your hosting provider may have disabled this feature for users, or you may have reached your limit.'
      },
      {
        name: '💡 What can you do?',
        value: `• Contact your hosting provider for assistance\n• Check if you have permission for this action\n• Verify your plan includes ${featureName.toLowerCase()}\n• Check panel dashboard for restrictions`
      },
      {
        name: '🔍 Technical Details',
        value: `Action: ${action}\nThis restriction is set by your hosting provider, not this bot.`
      }
    )
    .setFooter({ text: 'Contact your hosting provider if you believe this is an error' })
    .setTimestamp();
}

function createErrorEmbed(title, error, context = {}) {
  const embed = new EmbedBuilder()
    .setColor('#ff0000')
    .setTitle(`❌ ${title}`)
    .setDescription('An error occurred while processing your request.')
    .addFields(
      { name: '🔴 Error Message', value: `\`\`\`${error.message || 'Unknown error'}\`\`\`` }
    )
    .setTimestamp();

  if (context.serverId) {
    embed.addFields({ name: '🖥️ Server ID', value: `\`${context.serverId}\``, inline: true });
  }
  if (context.action) {
    embed.addFields({ name: '⚡ Action', value: context.action, inline: true });
  }

  const troubleshooting = [];

  if (error.message?.includes('not found')) {
    troubleshooting.push('• Verify the server/resource ID is correct');
    troubleshooting.push('• The resource may have been deleted');
  }

  if (error.message?.includes('offline') || error.message?.includes('running')) {
    troubleshooting.push('• Check if the server is in the correct state');
    troubleshooting.push('• Some actions require the server to be stopped/running');
  }

  if (error.message?.includes('timeout')) {
    troubleshooting.push('• The panel may be experiencing high load');
    troubleshooting.push('• Try again in a few moments');
  }

  if (troubleshooting.length > 0) {
    embed.addFields({ name: '💡 Troubleshooting', value: troubleshooting.join('\n') });
  }

  embed.setFooter({ text: 'If this error persists, contact your hosting provider' });

  return embed;
}

function handleApiError(error, featureName, action, context = {}) {
  if (isFeatureDisabledError(error)) {
    return createFeatureDisabledEmbed(featureName, action);
  }

  const errorMsg = error.message?.toLowerCase() || '';

  if (errorMsg.includes('limit') || errorMsg.includes('maximum')) {
    return new EmbedBuilder()
      .setColor('#ff9900')
      .setTitle('⚠️ Limit Reached')
      .setDescription(`You have reached the maximum ${featureName.toLowerCase()} limit.`)
      .addFields(
        { name: '📊 What does this mean?', value: `Your hosting plan has a limit on the number of ${featureName.toLowerCase()}s you can create.` },
        { name: '💡 Solutions', value: `• Delete unused ${featureName.toLowerCase()}s to free up space\n• Upgrade your hosting plan\n• Contact your provider to increase limits` },
        { name: '🔍 Error Details', value: `\`\`\`${error.message}\`\`\`` }
      )
      .setFooter({ text: 'Check your panel dashboard for current usage' })
      .setTimestamp();
  }

  if (errorMsg.includes('must be stopped') || errorMsg.includes('must be offline')) {
    return new EmbedBuilder()
      .setColor('#ff9900')
      .setTitle('⚠️ Invalid Server State')
      .setDescription('This action requires the server to be in a specific state.')
      .addFields(
        { name: '🔴 Required State', value: 'Server must be **stopped/offline**' },
        { name: '💡 What to do', value: '• Stop the server first using `/server stop`\n• Wait for server to fully stop\n• Try the action again' },
        { name: '🔍 Error Details', value: `\`\`\`${error.message}\`\`\`` }
      )
      .setTimestamp();
  }

  if (errorMsg.includes('must be running') || errorMsg.includes('must be online')) {
    return new EmbedBuilder()
      .setColor('#ff9900')
      .setTitle('⚠️ Invalid Server State')
      .setDescription('This action requires the server to be running.')
      .addFields(
        { name: '🟢 Required State', value: 'Server must be **running/online**' },
        { name: '💡 What to do', value: '• Start the server first using `/server start`\n• Wait for server to fully start\n• Try the action again' },
        { name: '🔍 Error Details', value: `\`\`\`${error.message}\`\`\`` }
      )
      .setTimestamp();
  }

  if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
    return new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Resource Not Found')
      .setDescription('The requested resource could not be found.')
      .addFields(
        { name: '🔍 Possible Reasons', value: '• The resource ID is incorrect\n• The resource was deleted\n• You don\'t have access to this resource' },
        { name: '💡 What to do', value: '• Double-check the ID\n• Use autocomplete to select from available resources\n• Verify you have the correct panel selected' },
        { name: '🔍 Error Details', value: `\`\`\`${error.message}\`\`\`` }
      )
      .setTimestamp();
  }

  return createErrorEmbed(`${featureName} Error`, error, context);
}

function createSuccessEmbed(title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

function createWarningEmbed(title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor('#ffaa00')
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

module.exports = {
  isFeatureDisabledError,
  createFeatureDisabledEmbed,
  createErrorEmbed,
  handleApiError,
  createSuccessEmbed,
  createWarningEmbed
};
