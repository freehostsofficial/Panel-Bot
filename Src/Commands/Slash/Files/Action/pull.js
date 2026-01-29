const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'pull',
    description: 'Ingests a remote resource from a provided URL.',
    category: 'Files',
    data: new SlashCommandBuilder()
        .setName('pull')
        .setDescription('Ingests a remote resource from a provided URL.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('url').setDescription('URL to pull file from').setRequired(true))
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
            const urlToPull = interaction.options.getString('url');
            const directory = interaction.options.getString('directory') || '/';

            await ptero.pullRemoteFile(panel.url, panel.apikey, serverId, urlToPull, directory);

            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('⬇️ Remote Ingestion Initiated')
                .setDescription(`A file pull request has been queued on instance \`${serverId}\`.`)
                .addFields(
                    { name: '🔗 Source URL', value: `\`${urlToPull.substring(0, 50)}${urlToPull.length > 50 ? '...' : ''}\``, inline: false },
                    { name: '📂 Target Directory', value: `\`${directory}\``, inline: false }
                )
                .setFooter({ text: 'The file will appear once the transfer is complete.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const errorEmbed = handleApiError(err, 'Remote Pull', 'ingest remote file', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
