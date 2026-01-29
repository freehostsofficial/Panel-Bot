const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
    name: 'delete-file',
    description: 'Permanently removes a target resource from the file system.',
    category: 'Files',
    data: new SlashCommandBuilder()
        .setName('delete-file')
        .setDescription('Permanently removes a target resource from the file system.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('file').setDescription('File or folder name').setRequired(true))
        .addStringOption(opt => opt.setName('root').setDescription('Directory path (default: /)').setRequired(false)),

    async autocomplete(interaction) {
        await pteroUtils.serverAutocomplete(interaction);
    },

    async execute(client, interaction) {
        const resolved = await pteroUtils.resolveServer(interaction);
        if (!resolved) {
            return interaction.reply({ content: '❌ Server not found or panel connection failed.', ephemeral: true });
        }

        const { panel, serverId } = resolved;
        const file = interaction.options.getString('file');
        const root = interaction.options.getString('root') || '/';

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🗑️ File Deletion Requested')
            .setDescription(`You are about to delete \`${file}\` from \`${root}\` on instance \`${serverId}\`.`)
            .addFields(
                { name: '⚠️ Warning', value: 'This action is **irreversible**. The file will be permanently lost.', inline: false }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_file_delete')
                .setLabel('Confirm Deletion')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'),
            new ButtonBuilder()
                .setCustomId('cancel_file_delete')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛡️')
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_file_delete') {
                await i.deferUpdate();
                try {
                    await ptero.deleteFiles(panel.url, panel.apikey, serverId, root, [file]);

                    const successEmbed = new EmbedBuilder()
                        .setColor('#2ECC71')
                        .setTitle('✅ Resource Deleted')
                        .setDescription(`The file/folder \`${file}\` has been successfully removed.`)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed], components: [] });
                } catch (err) {
                    const error = handleApiError(err, 'File Deletion', 'delete resource');
                    await interaction.editReply({ embeds: [error], components: [] });
                }
            } else {
                await i.update({ content: '🛡️ **Deletion Aborted.** File remains intact.', embeds: [], components: [] });
            }
            collector.stop();
        });
    }
};
