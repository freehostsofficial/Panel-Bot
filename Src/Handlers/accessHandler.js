const config = require('../../config');
const { EmbedBuilder } = require('discord.js');

/**
 * Middleware to check if a user has access to bot commands
 */
async function checkAccess(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const member = interaction.member;
  const userRoles = member?.roles?.cache?.map(r => r.id) || [];

  // Helper to get non-empty IDs from config
  const getCleanIds = (path) => {
    let val = config.get(path, []);

    // If it's a string (likely from .env), convert to array
    if (typeof val === 'string') {
      val = val.includes(',') ? val.split(',') : [val];
    }

    return Array.isArray(val) ? val.map(id => String(id).trim()).filter(id => id && id !== '' && !id.includes('_id_here')) : [];
  };

  const allowedUsers = getCleanIds('settings.developer.ids');
  const ownerIds = getCleanIds('settings.developer.owner_ids');
  const allowedGuilds = getCleanIds('settings.developer.guildids');
  const allowedRoles = getCleanIds('settings.developer.role_ids');

  const isOwner = ownerIds.includes(userId);
  const isAllowedUser = allowedUsers.includes(userId);
  const isAllowedRole = allowedRoles.length > 0 && userRoles.some(roleId => allowedRoles.includes(roleId));
  const isAllowedGuild = allowedGuilds.length > 0 && allowedGuilds.includes(guildId);

  // If no restrictions are set at all, allow everyone
  const hasAnyRestriction = allowedUsers.length > 0 || ownerIds.length > 0 || allowedRoles.length > 0 || allowedGuilds.length > 0;

  if (!hasAnyRestriction) {
    return true;
  }

  // If restrictions exist, user must be owner OR match one of the allowed criteria
  if (isOwner || isAllowedUser || isAllowedRole || isAllowedGuild) {
    return true;
  }

  // Special case: If only guild restrictions are set, and we are in a DM, check if allowedUsers/ownerIds are set
  // But our logic already handles this: if only allowedGuilds is set, and we are in DM (guildId null), isAllowedGuild is false.
  // Since hasAnyRestriction is true, and none of the criteria are met, it will deny access.
  // This is correct if the bot is intended to be restricted.

  const errorEmbed = new EmbedBuilder()
    .setColor('#ff0000')
    .setTitle('🚫 Access Denied')
    .setDescription('You do not have permission to use this bot or this command is restricted.')
    .setFooter({ text: 'Contact bot administrator for access.' });

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
  } else {
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
  return false;
}

module.exports = { checkAccess };
