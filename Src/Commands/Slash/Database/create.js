const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');
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
    const userId = interaction.user.id;
    const userData = await db.getUserData(userId);
    const selectedPanelName = userData.selectedPanel;
    const panel = userData.panels.find(p => p.name === selectedPanelName);
    if (!panel) {
      return interaction.respond([]);
    }

    try {
      const servers = await ptero.listServers(panel.url, panel.apikey);
      const focusedValue = interaction.options.getFocused().toLowerCase();
      const filtered = servers
        .filter(s => s.attributes.name.toLowerCase().includes(focusedValue) || s.attributes.identifier.toLowerCase().includes(focusedValue))
        .slice(0, 25);
      await interaction.respond(filtered.map(s => ({
        name: `${s.attributes.name} (${s.attributes.identifier})`,
        value: s.attributes.identifier
      })));
    } catch (err) {
      await interaction.respond([]);
    }
  },

  async execute(client, interaction) {
    const userId = interaction.user.id;
    const userData = await db.getUserData(userId);
    const selectedPanelName = userData.selectedPanel;
    const panel = userData.panels.find(p => p.name === selectedPanelName);
    if (!panel) {
      return interaction.reply({ content: '❌ No active bridge found. Use `/panel select`.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const serverId = interaction.options.getString('id');
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
            value: '```\nPassword: Specified during create/API call\n```*You must record your credentials now. For security, passwords cannot be retrieved post-provisioning.*',
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
