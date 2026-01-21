const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
    name: "delete",
    description: "Decommission a database cluster from the production net.",
    category: "Database",
    data: new SlashCommandBuilder()
        .setName("delete")
        .setDescription("Decommission a database cluster from the production net.")
        .addStringOption(opt => opt.setName("id").setDescription("Server ID").setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName("database").setDescription("Database internal ID").setRequired(true)),

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
        if (!panel) return interaction.reply({ content: "❌ No active bridge found. Use `/panel select`.", ephemeral: true });

        const serverId = interaction.options.getString("id");
        const databaseId = interaction.options.getString("database");

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🚨 Critical Table Purge requested')
            .setDescription(`You are about to decommission database \`${databaseId}\` on instance \`${serverId}\`.`)
            .addFields(
                { name: '⚠️ Risk Factor', value: '• All SQL tables and relations will be dropped.\n• Connected applications will lose database access.\n• **Operation is non-reversible.**', inline: false }
            )
            .setFooter({ text: 'Authorize the purge to proceed.' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_db_delete')
                .setLabel('Confirm Decommission')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('💣'),
            new ButtonBuilder()
                .setCustomId('cancel_db_delete')
                .setLabel('Abort Mission')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛡️')
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_db_delete') {
                await i.deferUpdate();
                try {
                    await ptero.deleteDatabase(panel.url, panel.apikey, serverId, databaseId);

                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ECC71')
                        .setTitle('✅ Database Decommissioned')
                        .setDescription(`The SQL instance \`${databaseId}\` has been successfully erased from the node registry.`)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                } catch (err) {
                    const error = handleApiError(err, 'Database Purge', 'execute relational decommission');
                    await interaction.editReply({ embeds: [error], components: [] });
                }
            } else {
                await i.update({ content: '🛡️ **Decommission Aborted.** Database remains operational.', embeds: [], components: [] });
            }
            collector.stop();
        });
    }
};
