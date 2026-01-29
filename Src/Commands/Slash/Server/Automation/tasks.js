const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { handleApiError } = require('../../../../Functions/errorHandler');
const { createPaginatedEmbed, chunkArray } = require('../../../../Functions/pagination');

module.exports = {
    name: 'schedule-tasks',
    description: 'Inspect the task sequence for a specific automation schedule.',
    category: 'Server',
    data: new SlashCommandBuilder()
        .setName('schedule-tasks')
        .setDescription('Inspect the task sequence for a specific automation schedule.')
        .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
        .addIntegerOption(opt => opt.setName('schedule').setDescription('Schedule ID').setRequired(true)),

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
            const scheduleId = interaction.options.getInteger('schedule');

            const schedule = await ptero.getSchedule(panel.url, panel.apikey, serverId, scheduleId);

            // Extract tasks from relationships
            let tasks = [];
            if (schedule.relationships && schedule.relationships.tasks && schedule.relationships.tasks.data) {
                tasks = schedule.relationships.tasks.data.map(t => t.attributes);
            }

            if (tasks.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor('#FF9900')
                    .setTitle(`📋 Schedule ${scheduleId}: No Tasks`)
                    .setDescription(`Schedule \`${schedule.name}\` has no configured tasks on instance \`${serverId}\`.`)
                    .addFields({ name: '💡 Tip', value: 'Use `/schedule-task-add` to add actions to this schedule.' })
                    .setTimestamp();
                return interaction.editReply({ embeds: [emptyEmbed] });
            }

            // Sort by sequence_id
            tasks.sort((a, b) => a.sequence_id - b.sequence_id);

            const chunked = chunkArray(tasks, 5);
            const embeds = chunked.map((chunk, index) => {
                const embed = new EmbedBuilder()
                    .setColor('#00d4ff')
                    .setTitle(`📋 Schedule Logic: ${schedule.name}`)
                    .setDescription(`Sequence audit for schedule ID \`${schedule.id}\` on **${panel.name}**.`)
                    .setFooter({ text: `Page ${index + 1} of ${chunked.length} • next_run: ${schedule.next_run_at || 'N/A'}` })
                    .setTimestamp();

                chunk.forEach(t => {
                    let actionDetails = '';
                    if (t.action === 'command') actionDetails = `\`${t.payload}\``;
                    else if (t.action === 'power') actionDetails = `Signal: \`${t.payload}\``;
                    else if (t.action === 'backup') actionDetails = `Ignored: \`${t.payload || 'None'}\``;

                    embed.addFields({
                        name: `Step ${t.sequence_id}: ${t.action.toUpperCase()}`,
                        value: `\`\`\`yml\nDetails: ${actionDetails}\nDelay: ${t.time_offset}s\nOn Failure: ${t.continue_on_failure ? 'Continue' : 'Abort'}\nID: ${t.id}\n\`\`\``,
                        inline: false
                    });
                });

                return embed;
            });

            await createPaginatedEmbed(interaction, embeds, { ephemeral: true });

        } catch (err) {
            const errorEmbed = handleApiError(err, 'Task Inspector', 'audit schedule tasks', { serverId: interaction.options.getString('id') });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
