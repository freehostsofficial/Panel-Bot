const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');
const { createPaginatedEmbed, chunkArray } = require('../../../Functions/pagination');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
    name: "list",
    description: "View the provisioned database cluster registry.",
    category: "Database",
    data: new SlashCommandBuilder()
        .setName("list")
        .setDescription("View the provisioned database cluster registry.")
        .addStringOption(opt => opt.setName("id").setDescription("Server ID").setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
        const userId = interaction.user.id;
        const userData = await db.getUserData(userId);
        const selectedPanelName = userData.selectedPanel;
        const panel = userData.panels.find(p => p.name === selectedPanelName);
        if (!panel) return interaction.respond([]);

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
        if (!panel) return interaction.reply({ content: "❌ You don't have an active panel selected.", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        try {
            const serverId = interaction.options.getString("id");
            const databases = await ptero.listDatabases(panel.url, panel.apikey, serverId);

            if (databases.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🗄️ No Databases Found')
                    .setDescription(`No databases found for server \`${serverId}\`.`)
                    .addFields(
                        { name: '💡 Next Steps', value: '• Use `/database create` to create your first database\n• Check your plan for database limits' }
                    )
                    .setFooter({ text: 'Databases are managed by your hosting node' });

                return interaction.editReply({ embeds: [embed] });
            }

            const chunked = chunkArray(databases, 4);
            const embeds = chunked.map((chunk, index) => {
                const embed = new EmbedBuilder()
                    .setColor('#00d4ff')
                    .setTitle(`🗄️ SQL Databases — ${serverId}`)
                    .setDescription(`Manage your relational data for server \`${serverId}\`.`)
                    .setFooter({ text: `Page ${index + 1} of ${chunked.length} • Panel: ${panel.name}` })
                    .setTimestamp();

                chunk.forEach(d => {
                    const attr = d.attributes;
                    embed.addFields({
                        name: `📍 DB: ${attr.name}`,
                        value: `\`\`\`yml\nHost: ${attr.host.address}:${attr.host.port}\nName: ${attr.database}\nUser: ${attr.username}\nRemote: ${attr.connections_from || '%'}\nID: ${attr.id}\`\`\``,
                        inline: true
                    });
                });

                return embed;
            });

            await createPaginatedEmbed(interaction, embeds, { ephemeral: true });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Database Listing', 'list databases', { serverId: interaction.options.getString("id") });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
