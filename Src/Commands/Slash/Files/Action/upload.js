const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'upload',
    description: 'Generates a secure upload endpoint for file transfer.',
    category: 'Files',
    data: new SlashCommandBuilder()
        .setName('upload')
        .setDescription('Generates a secure upload endpoint for file transfer.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('directory').setDescription('Target directory (default: /)').setRequired(false)),

    async autocomplete(interaction) {
        await pteroUtils.serverAutocomplete(interaction);
    },

    async execute(client, interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const resolved = await pteroUtils.resolveServer(interaction);
            if (!resolved) {
                return interaction.editReply({ content: '❌ Server not found or panel connection failed.', ephemeral: true });
            }

            const { panel, serverId } = resolved;
            const directory = interaction.options.getString('directory') || '/';

            const uploadUrl = await ptero.getUploadUrl(panel.url, panel.apikey, serverId, directory);

            const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('📤 Upload Gateway Established')
                .setDescription(`A secure upload tunnel has been provisioned for \`${serverId}\`.`)
                .addFields(
                    { name: '📂 Target Path', value: `\`${directory}\``, inline: true },
                    { name: '🔗 Endpoint', value: `[Click to open upload link](${uploadUrl})`, inline: true },
                    { name: '⚠️ Usage Info', value: 'This URL is valid for a single session. Use a tool like cURL or a browser to upload files.', inline: false }
                )
                .setFooter({ text: `Panel: ${panel.name} • Secure File Transfer Protocol` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Upload Gateway', 'provision upload link', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
