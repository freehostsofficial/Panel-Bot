const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'decompress',
    description: 'Extracts the contents of a compressed archive.',
    category: 'Files',
    data: new SlashCommandBuilder()
        .setName('decompress')
        .setDescription('Extracts the contents of a compressed archive.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('file').setDescription('Archive filename (e.g. archive.tar.gz)').setRequired(true))
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

            await ptero.decompressFile(panel.url, panel.apikey, serverId, root, file);

            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('📦 Extraction Complete')
                .setDescription(`Archive contents have been extracted effectively on \`${serverId}\`.`)
                .addFields(
                    { name: '📦 Source Archive', value: `\`${file}\``, inline: true },
                    { name: '📂 Target Directory', value: `\`${root}\``, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Extraction Protocol', 'decompress archive', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
