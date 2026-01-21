const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: "edit",
    description: "Reconfigure the connectivity parameters for a panel.",
    category: "Panel",
    data: new SlashCommandBuilder()
        .setName("edit")
        .setDescription("Reconfigure the connectivity parameters for a panel.")
        .addStringOption(opt => opt.setName("name").setDescription("Panel name identifier").setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName("url").setDescription("New endpoint URI (e.g. https://panel.example.com)"))
        .addStringOption(opt => opt.setName("apikey").setDescription("New User API Authorization Key")),

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
        const name = interaction.options.getString("name");
        const newUrlInput = interaction.options.getString("url");
        const newApiKey = interaction.options.getString("apikey");

        if (!newUrlInput && !newApiKey) return interaction.editReply("❌ Mission parameters missing: Specify either a new URL or API Key.");

        const userData = await db.getUserData(userId);
        const panel = userData.panels.find(p => p.name.toLowerCase() === name.toLowerCase());

        if (!panel) return interaction.editReply(`❌ Panel target **${name}** not identified in registry.`);

        const updatedFields = [];
        let validationRequired = false;

        if (newUrlInput) {
            const cleanUrl = newUrlInput.replace(/\/$/, '');
            if (!cleanUrl.startsWith('http')) return interaction.editReply("❌ Protocol violation: URL must utilize `http://` or `https://`.");
            panel.url = cleanUrl;
            updatedFields.push('Endpoint URL');
            validationRequired = true;
        }

        if (newApiKey) {
            panel.apikey = newApiKey;
            updatedFields.push('Authorization Key');
            validationRequired = true;
        }

        if (validationRequired) {
            const validation = await ptero.validateKey(panel.url, panel.apikey);
            if (!validation.valid) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('🔐 Reconfiguration Failure')
                    .setDescription(`The new parameters for **${panel.name}** failed the security handshake.`)
                    .addFields({ name: '🚫 Diagnostic Code', value: `\`\`\`${validation.error}\`\`\`` })
                    .setFooter({ text: 'Changes have NOT been applied to the registry.' });
                return interaction.editReply({ embeds: [errorEmbed] });
            }
        }

        await db.savePanel(userId, panel);

        const domain = new URL(panel.url).hostname;

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('⚙️ Connectivity Reconfigured')
            .setDescription(`Registry parameters for **${panel.name}** have been updated.`)
            .addFields(
                { name: '✏️ Modified Modules', value: updatedFields.join(', '), inline: true },
                { name: '🌐 Verified Endpoint', value: `\`${domain}\``, inline: true },
                { name: '📊 Integrity', value: 'Security handshake successful.', inline: false }
            )
            .setFooter({ text: 'System ready for immediate utilization.' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
