const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
    name: "delete",
    description: "Permanently decommission a stored container snapshot.",
    category: "Backup",
    data: new SlashCommandBuilder()
        .setName("delete")
        .setDescription("Permanently decommission a stored container snapshot.")
        .addStringOption(opt => opt.setName("id").setDescription("Server ID").setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName("backup").setDescription("Backup UUID").setRequired(true)),

    async autocomplete(interaction) {
        const userId = interaction.user.id;
        const userData = await db.getUserData(userId);
        const selectedPanelName = userData.selectedPanel;
        const panel = userData.panels.find(p => p.name === selectedPanelName);
        if (!panel) return interaction.respond([]);

        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'id') {
            try {
                const servers = await ptero.listServers(panel.url, panel.apikey);
                const filtered = servers
                    .filter(s => s.attributes.name.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
                        s.attributes.identifier.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25);
                await interaction.respond(filtered.map(s => ({
                    name: `${s.attributes.name} (${s.attributes.identifier})`,
                    value: s.attributes.identifier
                })));
            } catch (err) {
                await interaction.respond([]);
            }
        }
    },

    async execute(client, interaction) {
        const userId = interaction.user.id;
        const userData = await db.getUserData(userId);
        const selectedPanelName = userData.selectedPanel;
        const panel = userData.panels.find(p => p.name === selectedPanelName);
        if (!panel) return interaction.reply({ content: "❌ No active bridge found. Use `/panel select`.", ephemeral: true });

        const serverId = interaction.options.getString("id");
        const backupId = interaction.options.getString("backup");

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🗑️ Snapshot Purge Requested')
            .setDescription(`You are about to permanently delete snapshot \`${backupId}\` from instance \`${serverId}\`.`)
            .addFields(
                { name: '⚠️ Risk Factor', value: 'This action will reclaim storage space but the data snapshot will be **lost forever**.', inline: false }
            )
            .setFooter({ text: 'Confirm the deletion to proceed.' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_delete')
                .setLabel('Purge Snapshot')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('cancel_delete')
                .setLabel('Keep Snapshot')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛡️')
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_delete') {
                await i.deferUpdate();
                try {
                    await ptero.deleteBackup(panel.url, panel.apikey, serverId, backupId);

                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ECC71')
                        .setTitle('✅ Snapshot Purged')
                        .setDescription(`The backup snapshot \`${backupId}\` has been successfully erased from the node storage.`)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                } catch (err) {
                    const error = handleApiError(err, 'Storage Purge', 'erase data snapshot');
                    await interaction.editReply({ embeds: [error], components: [] });
                }
            } else {
                await i.update({ content: '🛡️ **Purge Aborted.** Snapshot remains in storage.', embeds: [], components: [] });
            }
            collector.stop();
        });
    }
};
