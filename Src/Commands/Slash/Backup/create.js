const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../Functions/pteroService');
const pteroUtils = require('../../../Functions/pteroUtils');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
  name: 'create',
  description: 'Initiate a high-integrity environmental snapshot.',
  category: 'Backup',
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Initiate a high-integrity environmental snapshot.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('name').setDescription('Optional descriptive label'))
    .addStringOption(opt => opt.setName('ignored').setDescription('Files/patterns to ignore (comma separated, e.g. *.log, temp/*)')),

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
      const name = interaction.options.getString('name');
      const ignoredInput = interaction.options.getString('ignored');
      const ignored = ignoredInput ? ignoredInput.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];

      const backup = await ptero.createBackup(panel.url, panel.apikey, serverId, name, ignored);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('📤 Snapshot Protocol Initiated')
        .setDescription(`A manual data backup has been triggered for instance \`${serverId}\` on **${panel.name}**.`)
        .addFields(
          { name: '📓 Label', value: backup.name || '*Auto-generated*', inline: true },
          { name: '🆔 Snapshot ID', value: `\`${backup.uuid.substring(0, 8)}\``, inline: true },
          { name: '⏳ Status', value: 'Data Collection In Progress', inline: true },
          { name: '📋 Process Details', value: `\`\`\`yml\nTrigger: API Call\nTarget: ${serverId}\nPanel: ${panel.name}\nIgnored: ${ignored.length > 0 ? ignored.join(', ') : 'None'}\nLog: Snapshot compression started.\n\`\`\`*Large servers may take 10-20 minutes to complete.*`, inline: false }
        )
        .setFooter({ text: `Panel: ${panel.name} • Monitor progress with /backup list` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Backup Protocol', 'initialize snapshot', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
