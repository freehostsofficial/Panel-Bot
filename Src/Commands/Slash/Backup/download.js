const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../Functions/pteroService');
const pteroUtils = require('../../../Functions/pteroUtils');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
    name: "download",
    description: "Generate a secure, ephemeral export link for a snapshot.",
    category: "Backup",
    data: new SlashCommandBuilder()
        .setName("download")
        .setDescription("Generate a secure, ephemeral export link for a snapshot.")
        .addStringOption(opt => opt.setName("id").setDescription("Server ID").setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName("backup").setDescription("Backup UUID").setRequired(true)),

    async autocomplete(interaction) {
        await pteroUtils.serverAutocomplete(interaction);
    },

    async execute(client, interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const resolved = await pteroUtils.resolveServer(interaction);
            if (!resolved) return interaction.editReply({ content: "❌ Server not found or panel connection failed.", ephemeral: true });

            const { panel, serverId } = resolved;
            const backupId = interaction.options.getString("backup");

            const downloadUrl = await ptero.getBackupDownload(panel.url, panel.apikey, serverId, backupId);

            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('📥 Snapshot Export Ready')
                .setDescription(`An ephemeral download link has been generated for registry item \`${backupId}\` on **${panel.name}**.`)
                .addFields(
                    { name: '🔗 Download URL', value: `[Click here to download](${downloadUrl})`, inline: false },
                    { name: '⚠️ Security Notice', value: 'This link is ephemeral and will expire. Do not share this URL with unauthorized users.', inline: false }
                )
                .setFooter({ text: `Panel: ${panel.name} • Data transport secured.` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const error = handleApiError(err, 'Snapshot Export', 'generate download link', { serverId: interaction.options.getString("id") });
            await interaction.editReply({ embeds: [error] });
        }
    }
};
