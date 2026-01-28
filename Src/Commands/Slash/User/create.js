const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../Functions/pteroService');
const pteroUtils = require('../../../Functions/pteroUtils');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
  name: 'create',
  description: 'Authorize a new secondary identity for the instance.',
  category: 'User',
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Authorize a new secondary identity for the instance.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('email').setDescription("User's email associated with their panel account").setRequired(true))
    .addStringOption(opt => opt.setName('permissions').setDescription('Comma-separated permissions (leave empty for ADMIN)').setRequired(false)),

  async autocomplete(interaction) {
    await pteroUtils.serverAutocomplete(interaction);
  },

  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const resolved = await pteroUtils.resolveServer(interaction);
      if (!resolved) {
        return interaction.editReply({ content: '❌ Server not found or panel connection failed.', ephemeral: true });
      }

      const { panel, serverId } = resolved;
      const email = interaction.options.getString('email');
      const permsInput = interaction.options.getString('permissions');

      // Default permissions if none provided (Basic power + console)
      // Or use a more extensive list for "Admin-like" access
      const permissions = permsInput
        ? permsInput.split(',').map(p => p.trim())
        : [
          'control.console', 'control.start', 'control.stop', 'control.restart',
          'file.read', 'file.read-content', 'file.create', 'file.update', 'file.delete', 'file.archive', 'file.sftp',
          'backup.read', 'backup.create', 'backup.delete', 'backup.download', 'backup.restore',
          'database.read', 'database.create', 'database.update', 'database.delete', 'database.view-password',
          'schedule.read', 'schedule.create', 'schedule.update', 'schedule.delete',
          'allocation.read', 'allocation.create', 'allocation.update', 'allocation.delete',
          'startup.read', 'startup.update'
        ];

      const attributes = await ptero.createSubuser(panel.url, panel.apikey, serverId, email, permissions);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🤝 Identity Authorized')
        .setDescription(`A new secondary identity has been successfully integrated into the \`${serverId}\` registry.`)
        .addFields(
          { name: '👤 Identity', value: `\`${attributes.username}\``, inline: true },
          { name: '📧 Email', value: `\`${attributes.email}\``, inline: true },
          { name: '🛡️ Scope', value: `\`${attributes.permissions.length}\` modules authorized.`, inline: false }
        )
        .setFooter({ text: 'Access control updated successfully.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const error = handleApiError(err, 'Identity Authorization', 'provision new subuser', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [error] });
    }
  }
};
