const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../Functions/pteroService');
const pteroUtils = require('../../../Functions/pteroUtils');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
  name: 'create',
  description: 'Provision a new high-performance SQL data cluster.',
  category: 'Database',
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Provision a new high-performance SQL data cluster.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('database').setDescription('Database descriptive name').setRequired(true))
    .addStringOption(opt => opt.setName('remote').setDescription('Authorized host (default: % for any)').setRequired(false)),

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
      const database = interaction.options.getString('database');
      const remote = interaction.options.getString('remote') || '%';

      const newDb = await ptero.createDatabase(panel.url, panel.apikey, serverId, database, remote);

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('💎 Database Provisioned')
        .setDescription(`A new relational database environment has been established for \`${serverId}\`.`)
        .addFields(
          {
            name: '📊 Environment Details',
            value: `\`\`\`yml\nDatabase: ${newDb.database}\nUsername: ${newDb.username}\nHost: ${newDb.host.address}:${newDb.host.port}\nRemote: ${newDb.connections_from}\nMax Conn: ${newDb.max_connections}\n\`\`\``,
            inline: false
          },
          {
            name: '🔑 System Access',
            value: `\`\`\`bash\nPassword: ${newDb.password} \n\`\`\`\n**⚠️ SAVE THIS PASSWORD NOW.** It cannot be viewed again.`,
            inline: false
          }
        )
        .setFooter({ text: `ID: ${newDb.id} • SQL Instance Managed` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Database Provisioning', 'create new database environment', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
