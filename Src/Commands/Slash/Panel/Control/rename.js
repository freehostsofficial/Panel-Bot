const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../../Functions/database');

module.exports = {
    name: "rename",
    description: "Rebrand the identity of a panel gateway.",
    category: "Panel",
    data: new SlashCommandBuilder()
        .setName("rename")
        .setDescription("Rebrand the identity of a panel gateway.")
        .addStringOption(opt => opt.setName("current").setDescription("Legacy panel identifier").setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName("new").setDescription("New visual identity label").setRequired(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const userData = await db.getUserData(interaction.user.id);
        const panels = userData.panels || [];
        const filtered = panels.filter(p => p.name.toLowerCase().includes(focusedValue));
        await interaction.respond(filtered.map(p => ({ name: p.name, value: p.name })));
    },

    async execute(client, interaction) {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const currentName = interaction.options.getString("current");
        const newName = interaction.options.getString("new");
        const userData = await db.getUserData(userId);
        const panel = userData.panels.find(p => p.name.toLowerCase() === currentName.toLowerCase());

        if (!panel) return interaction.editReply(`❌ Legacy identifier **${currentName}** not found in registry.`);

        const duplicate = userData.panels.some(p => p.name.toLowerCase() === newName.toLowerCase());
        if (duplicate) return interaction.editReply(`❌ Registry conflict: Identifier **${newName}** is already allocated.`);

        panel.name = newName;
        await db.savePanel(userId, panel);

        const domain = new URL(panel.url).hostname;

        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('🏷️ Identity Rebranded')
            .setDescription(`The registry label for your panel instance has been successfully updated.`)
            .addFields(
                { name: '⬅️ Legacy Label', value: `\`${currentName}\``, inline: true },
                { name: '➡️ New Identity', value: `\`${newName}\``, inline: true },
                { name: '🌐 Endpoint', value: `\`${domain}\``, inline: false }
            )
            .setFooter({ text: 'Registry metadata synchronization complete.' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
