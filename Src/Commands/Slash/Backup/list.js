const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');
const { createPaginatedEmbed, chunkArray } = require('../../../Functions/pagination');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
    name: "list",
    description: "Audit the historical snapshot registry for this instance.",
    category: "Backup",
    data: new SlashCommandBuilder()
        .setName("list")
        .setDescription("Audit the historical snapshot registry for this instance.")
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
            const backups = await ptero.listBackups(panel.url, panel.apikey, serverId);

            if (backups.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('💾 No Backups Found')
                    .setDescription(`No backups found for server \`${serverId}\`.`)
                    .addFields(
                        { name: '💡 Next Steps', value: '• Use `/backup create` to create your first backup\n• Backups may be disabled by your host' }
                    )
                    .setFooter({ text: 'Storage limits might apply depending on your plan' });

                return interaction.editReply({ embeds: [embed] });
            }

            const chunked = chunkArray(backups, 5);
            const embeds = chunked.map((chunk, index) => {
                const embed = new EmbedBuilder()
                    .setColor('#00ff88')
                    .setTitle(`📦 ${serverId} — Backups`)
                    .setDescription(`Showing ${index * 5 + 1}-${Math.min((index + 1) * 5, backups.length)} of ${backups.length} snapshots.`)
                    .setFooter({ text: `Page ${index + 1} of ${chunked.length} • Panel: ${panel.name}` })
                    .setTimestamp();

                chunk.forEach(b => {
                    const attr = b.attributes;
                    const size = (attr.bytes / 1024 / 1024).toFixed(2);
                    const date = new Date(attr.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    });

                    const statusIcon = attr.is_successful ? '✅' : '❌';
                    const lockIcon = attr.is_locked ? '🔒' : '🔓';

                    embed.addFields({
                        name: `${attr.name || 'Unnamed Snapshot'}`,
                        value: `\`\`\`yml\nStatus: ${statusIcon} ${attr.is_successful ? 'Success' : 'Failed'}\nSecurity: ${lockIcon} ${attr.is_locked ? 'Locked' : 'Unlocked'}\nSize: ${size} MB\nDate: ${date}\nUUID: ${attr.uuid.substring(0, 8)}...\n\`\`\``,
                        inline: true
                    });
                });

                return embed;
            });

            await createPaginatedEmbed(interaction, embeds, { ephemeral: true });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Backup Listing', 'list backups', { serverId: interaction.options.getString("id") });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
