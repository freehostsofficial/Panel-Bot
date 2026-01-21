const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'console',
  description: 'Transmit low-level commands to the remote terminal.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('console')
    .setDescription('Transmit low-level commands to the remote terminal.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('command').setDescription('Target command string').setRequired(true)),

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
      const command = interaction.options.getString('command');

      await ptero.sendCommand(panel.url, panel.apikey, serverId, command);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🔌 Remote Command Dispatched')
        .setDescription(`The command has been successfully piped to the \`${serverId}\` console on **${panel.name}**.`)
        .addFields(
          { name: '💻 Terminal Input', value: `\`\`\`bash\n> ${command}\n\`\`\``, inline: false },
          { name: '🌐 Endpoint', value: `\`${panel.name}\``, inline: true },
          { name: '🆔 Target', value: `\`${serverId}\``, inline: true }
        )
        .setFooter({ text: 'Commands are executed with user-level privileges.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Remote Terminal', 'pipe console command', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
