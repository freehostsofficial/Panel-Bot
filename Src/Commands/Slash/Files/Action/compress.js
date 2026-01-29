const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'compress',
    description: 'Aggregates selected resources into a compressed archive.',
    category: 'Files',
    data: new SlashCommandBuilder()
        .setName('compress')
        .setDescription('Aggregates selected resources into a compressed archive.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('file').setDescription('File or folder to compress').setRequired(true))
        .addStringOption(opt => opt.setName('root').setDescription('Directory path (default: /)').setRequired(false)),

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
            const file = interaction.options.getString('file');
            const root = interaction.options.getString('root') || '/';

            const archive = await ptero.compressFiles(panel.url, panel.apikey, serverId, root, [file]);

            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('📦 Compression Complete')
                .setDescription(`Resources have been aggregated into an archive on instance \`${serverId}\`.`)
                .addFields(
                    { name: '📦 Archive Name', value: `\`${archive.name}\``, inline: true },
                    { name: '📄 Source', value: `\`${file}\``, inline: true },
                    { name: '📂 Directory', value: `\`${root}\``, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Compression Protocol', 'archive resources', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
