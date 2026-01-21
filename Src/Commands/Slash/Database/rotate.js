const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
    name: "rotate",
    description: "Cycle cryptographic credentials for a database instance.",
    category: "Database",
    data: new SlashCommandBuilder()
        .setName("rotate")
        .setDescription("Cycle cryptographic credentials for a database instance.")
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

        await interaction.deferReply({ ephemeral: true });

        try {
            const serverId = interaction.options.getString("id");
            const databaseId = interaction.options.getString("database");

            const updatedDb = await ptero.rotateDatabasePassword(panel.url, panel.apikey, serverId, databaseId);

            const embed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setTitle('🔐 Credential Cycle: Completed')
                .setDescription(`The security credentials for database \`${updatedDb.name}\` have been rotated.`)
                .addFields(
                    { name: '🗄️ Database Instance', value: `\`${updatedDb.database}\``, inline: true },
                    { name: '👤 Username', value: `\`${updatedDb.username}\``, inline: true },
                    { name: '🔑 New Password', value: '||Password is specified via API/Panel||', inline: false },
                    {
                        name: '🛡️ Action Required',
                        value: '1. Record the new password immediately.\n2. Update all application `.env` or config files.\n3. Restart connected services.\n*The old password is now invalid.*',
                        inline: false
                    }
                )
                .setFooter({ text: 'Security Breach Protocol: Rotate all connected service passwords.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Credential Cycle', 'rotate database instance password', {
                serverId: interaction.options.getString("id"),
                action: 'Rotate Password'
            });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
