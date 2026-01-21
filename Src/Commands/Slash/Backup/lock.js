const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../Functions/pteroService');
const pteroUtils = require('../../../Functions/pteroUtils');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
  name: 'lock',
  description: 'Toggle immutable status to prevent accidental snapshot purge.',
  category: 'Backup',
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Toggle immutable status to prevent accidental snapshot purge.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('backup').setDescription('Backup UUID').setRequired(true)),

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
      const backupId = interaction.options.getString('backup');

      const attributes = await ptero.toggleBackupLock(panel.url, panel.apikey, serverId, backupId);
      const isLocked = attributes.is_locked;

      const embed = new EmbedBuilder()
        .setColor(isLocked ? '#E74C3C' : '#2ECC71')
        .setTitle(`🔐 Snapshot Storage: ${isLocked ? 'Immutable' : 'Unlocked'}`)
        .setDescription(`The security status for snapshot \`${backupId}\` on **${panel.name}** has been toggled.`)
        .addFields(
          { name: '🛡️ Protection', value: isLocked ? '✅ Enabled (Safety Lock)' : '❌ Disabled (Deletable)', inline: true },
          { name: '🆔 Target', value: `\`${serverId}\``, inline: true },
          { name: '🌐 Panel', value: panel.name, inline: true }
        )
        .setFooter({ text: isLocked ? 'This snapshot cannot be deleted until unlocked.' : 'This snapshot can now be purged from the registry.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const error = handleApiError(err, 'Snapshot Lock', 'toggle immutable flag', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [error] });
    }
  }
};
