const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../../Functions/database');

module.exports = {
    name: "remove",
    description: "Decommission an existing panel gateway connection.",
    category: "Panel",
    data: new SlashCommandBuilder()
        .setName("remove")
        .setDescription("Decommission an existing panel gateway connection.")
        .addStringOption(opt => opt.setName("name").setDescription("Panel name identifier").setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const userData = await db.getUserData(interaction.user.id);
        const panels = userData.panels || [];
        const filtered = panels.filter(p => p.name.toLowerCase().includes(focusedValue));
        await interaction.respond(filtered.map(p => ({ name: p.name, value: p.name })));
    },

    async execute(client, interaction) {
        const userId = interaction.user.id;
        const name = interaction.options.getString("name");
        const userData = await db.getUserData(userId);
        const panel = userData.panels.find(p => p.name.toLowerCase() === name.toLowerCase());

        if (!panel) return interaction.reply({ content: `❌ Panel target **${name}** not identified in registry.`, ephemeral: true });

        const domain = new URL(panel.url).hostname;

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🚨 Decommission Authorization Required')
            .setDescription(`You are about to unlink the panel environment **${panel.name}** from your account.`)
            .addFields(
                {
                    name: '📊 Registry Data',
                    value: `\`\`\`yml\nIdentifier: ${panel.name}\nEndpoint: ${domain}\nAuth: Encrypted Key\n\`\`\``,
                    inline: false
                },
                {
                    name: '🛡️ Scope of Action',
                    value: '• Local registry data will be purged.\n• API credentials will be discarded from memory.\n• **No server data on the panel itself will be affected.**',
                    inline: false
                }
            )
            .setFooter({ text: 'Session expires in 45 seconds.' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_remove')
                .setLabel('Authorize Decommission')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('💣'),
            new ButtonBuilder()
                .setCustomId('cancel_remove')
                .setLabel('Keep Connection')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛡️')
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 45000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_remove') {
                await i.deferUpdate();
                const removed = await db.removePanel(userId, name);
                if (removed) {
                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ECC71')
                        .setTitle('✅ Connection Decommissioned')
                        .setDescription(`The registry has been successfully purged of the **${name}** endpoint data.`)
                        .addFields(
                            { name: '📂 Remaining Registry', value: `You have \`${userData.panels.length - 1}\` active connections remaining.`, inline: true }
                        )
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                } else {
                    await interaction.editReply({ content: '❌ Operational failure during decommissioning process.', embeds: [], components: [] });
                }
            } else {
                await i.update({ content: '🛡️ **Decommission Aborted.** Connectivity remains intact.', embeds: [], components: [] });
            }
            collector.stop();
        });
    }
};
