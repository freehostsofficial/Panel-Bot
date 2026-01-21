const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../../../Functions/database');

module.exports = {
    name: "list",
    description: "Overview of all synchronized panel gateways.",
    category: "Panel",
    data: new SlashCommandBuilder()
        .setName("list")
        .setDescription("Overview of all synchronized panel gateways."),

    async execute(client, interaction) {
        await interaction.deferReply({ ephemeral: true });

        const userData = await db.getUserData(interaction.user.id);
        const panels = userData.panels || [];

        if (panels.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setColor('#FF9900')
                .setTitle('📂 No Panels Synced')
                .setDescription('You haven\'t linked any Pterodactyl panels to your account yet.')
                .addFields({ name: '🚀 Get Started', value: 'Use the `/panel control add` command to link your first panel with an API key.' });

            return interaction.editReply({ embeds: [emptyEmbed] });
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📋 Pterodactyl Panel Registry')
            .setDescription(`You currently have **${panels.length}** panels distributed across your account.`)
            .setTimestamp();

        panels.forEach((p, idx) => {
            const domain = new URL(p.url).hostname;

            embed.addFields({
                name: `🔹 ${p.name}`,
                value: `\`\`\`yml\nHost: ${domain}\nIndex: #${idx + 1}\n\`\`\``,
                inline: true
            });
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('goto_add')
                .setLabel('Add New')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('➕')
        );

        const msg = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = msg.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async i => {
            if (i.customId === 'goto_add') {
                await i.reply({ content: 'Use `/panel control add` to link a new Pterodactyl instance.', ephemeral: true });
            }
        });
    }
};
