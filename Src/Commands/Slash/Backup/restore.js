const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ptero = require('../../../Functions/pteroService');
const pteroUtils = require('../../../Functions/pteroUtils');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
    name: "restore",
    description: "Execute a full-scale environmental rollback from a snapshot.",
    category: "Backup",
    data: new SlashCommandBuilder()
        .setName("restore")
        .setDescription("Execute a full-scale environmental rollback from a snapshot.")
        .addStringOption(opt => opt.setName("id").setDescription("Server ID").setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName("backup").setDescription("Backup UUID").setRequired(true))
        .addBooleanOption(opt => opt.setName("truncate").setDescription("Delete all files before restoring? (DANGER)").setRequired(false)),

    async autocomplete(interaction) {
        await pteroUtils.serverAutocomplete(interaction);
    },

    async execute(client, interaction) {
        const resolved = await pteroUtils.resolveServer(interaction);
        if (!resolved) return interaction.reply({ content: "❌ Server not found or panel connection failed.", ephemeral: true });

        const { panel, serverId } = resolved;
        const backupId = interaction.options.getString("backup");
        const truncate = interaction.options.getBoolean("truncate") || false;

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🚨 Snapshot Restoration: Authorization Required')
            .setDescription(`You are about to ROLL BACK the environment \`${serverId}\` on **${panel.name}** to snapshot \`${backupId}\`.`)
            .addFields(
                { name: '⚠️ Risk Factor', value: '• This will overwrite current server data.\n• Current unsaved progress will be lost.\n' + (truncate ? '• **TRUNCATE ENABLED:** All current files will be deleted before restoration.' : '• Files not in the backup may persist.'), inline: false }
            )
            .setFooter({ text: `Panel: ${panel.name} • Authorize the rollback to proceed.` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_restore')
                .setLabel('Authorize Rollback')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⏳'),
            new ButtonBuilder()
                .setCustomId('cancel_restore')
                .setLabel('Abort Mission')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛡️')
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_restore') {
                await i.deferUpdate();
                try {
                    await ptero.restoreBackup(panel.url, panel.apikey, serverId, backupId, truncate);

                    const successEmbed = new EmbedBuilder()
                        .setColor('#F1C40F')
                        .setTitle('⏳ Rollback Protocol Initiated')
                        .setDescription(`The restoration process for snapshot \`${backupId}\` on **${panel.name}** has been queued.`)
                        .addFields(
                            { name: '⚡ Status', value: 'Server is entering maintenance mode. It will reboot once the files are synchronized.', inline: false }
                        )
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                } catch (err) {
                    const error = handleApiError(err, 'Snapshot Rollback', 'execute environment restoration');
                    await interaction.editReply({ embeds: [error], components: [] });
                }
            } else {
                await i.update({ content: '🛡️ **Rollback Aborted.** Environment remains in current state.', embeds: [], components: [] });
            }
            collector.stop();
        });
    }
};
