const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: "allocation-remove",
    description: "Decommission a network allocation from the gateway.",
    category: "Server",
    data: new SlashCommandBuilder()
        .setName("allocation-remove")
        .setDescription("Decommission a network allocation from the gateway.")
        .addStringOption(opt => opt.setName("id").setDescription("Server ID").setRequired(true).setAutocomplete(true))
        .addIntegerOption(opt => opt.setName("allocation").setDescription("Allocation Internal ID").setRequired(true)),

    async autocomplete(interaction) {
        await pteroUtils.serverAutocomplete(interaction);
    },

    async execute(client, interaction) {
        const resolved = await pteroUtils.resolveServer(interaction);
        if (!resolved) return interaction.reply({ content: "❌ Server not found or panel connection failed.", ephemeral: true });

        const { panel, serverId } = resolved;
        const allocationId = interaction.options.getInteger("allocation");

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🚨 Route Decommission: Authorization Required')
            .setDescription(`You are about to PERMANENTLY remove network route \`${allocationId}\` from instance \`${serverId}\` on **${panel.name}**.`)
            .addFields(
                { name: '⚠️ Risk Factor', value: '• This port will no longer be reachable.\n• Services relying on this port will fail to connect externally.\n• **Operation is non-reversible.**', inline: false }
            )
            .setFooter({ text: `Panel: ${panel.name} • Authorize the decommission to proceed.` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_allocation_remove')
                .setLabel('Authorize Decommission')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('💣'),
            new ButtonBuilder()
                .setCustomId('cancel_allocation_remove')
                .setLabel('Abort Mission')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛡️')
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_allocation_remove') {
                await i.deferUpdate();
                try {
                    await ptero.removeAllocation(panel.url, panel.apikey, serverId, allocationId);

                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ECC71')
                        .setTitle('✅ Route Decommissioned')
                        .setDescription(`The network allocation \`${allocationId}\` has been erased from the instance configuration on **${panel.name}**.`)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                } catch (err) {
                    const error = handleApiError(err, 'Network Routing', 'execute route decommission');
                    await interaction.editReply({ embeds: [error], components: [] });
                }
            } else {
                await i.update({ content: '🛡️ **Decommission Aborted.** Network route remains operational.', embeds: [], components: [] });
            }
            collector.stop();
        });
    }
};
