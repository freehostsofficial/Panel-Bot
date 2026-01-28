const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../Functions/pteroService');
const pteroUtils = require('../../../Functions/pteroUtils');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
  name: 'rotate',
  description: 'Cycle cryptographic credentials for a database instance.',
  category: 'Database',
  data: new SlashCommandBuilder()
    .setName('rotate')
    .setDescription('Cycle cryptographic credentials for a database instance.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('database').setDescription('Database internal ID').setRequired(true)),

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
      const databaseId = interaction.options.getString('database');

      const updatedDb = await ptero.rotateDatabasePassword(panel.url, panel.apikey, serverId, databaseId);

      const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('🔐 Credential Cycle: Completed')
        .setDescription(`The security credentials for database \`${updatedDb.name}\` have been rotated.`)
        .addFields(
          { name: '🗄️ Database Instance', value: `\`${updatedDb.database}\``, inline: true },
          { name: '👤 Username', value: `\`${updatedDb.username}\``, inline: true },
          { name: '🔑 New Password', value: '||Password is specified via API/Panel||', inline: false },
          {
            name: '🛡️ Action Required',
            value: '1. Record the new password immediately.\n2. Update all application `.env` or config files.\n3. Restart connected services.\n*The old password is now invalid.*',
            inline: false
          }
        )
        .setFooter({ text: 'Security Breach Protocol: Rotate all connected service passwords.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Credential Cycle', 'rotate database instance password', {
        serverId: interaction.options.getString('id'),
        action: 'Rotate Password'
      });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
