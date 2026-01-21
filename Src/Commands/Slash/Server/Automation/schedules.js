const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ptero = require('../../../../Functions/pteroService');
const pteroUtils = require('../../../../Functions/pteroUtils');
const { createPaginatedEmbed, chunkArray } = require('../../../../Functions/pagination');
const { handleApiError } = require('../../../../Functions/errorHandler');

module.exports = {
  name: 'schedules',
  description: 'Audit the automation engine and task chronography.',
  category: 'Server',
  data: new SlashCommandBuilder()
    .setName('schedules')
    .setDescription('Audit the automation engine and task chronography.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true)),

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
      const schedules = await ptero.listSchedules(panel.url, panel.apikey, serverId);

      if (schedules.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setColor('#FF9900')
          .setTitle('⏰ Automation: None Configured')
          .setDescription(`No automated schedules were found for instance \`${serverId}\` on **${panel.name}**.`)
          .setTimestamp();
        return interaction.editReply({ embeds: [emptyEmbed] });
      }

      const chunked = chunkArray(schedules, 5);
      const embeds = chunked.map((chunk, index) => {
        const embed = new EmbedBuilder()
          .setColor('#aa66ff')
          .setTitle(`⏰ Automation Engine: ${serverId}`)
          .setDescription(`Identified **${schedules.length}** automated routines configured for this instance on **${panel.name}**.`)
          .setFooter({ text: `Page ${index + 1} of ${chunked.length} • Panel: ${panel.name}` })
          .setTimestamp();

        chunk.forEach(s => {
          const attr = s.attributes;
          const status = attr.is_active ? 'Active' : 'Paused';
          const icon = attr.is_active ? '🟢' : '⏸️';
          const cron = `${attr.cron.minute} ${attr.cron.hour} ${attr.cron.day_of_month} ${attr.cron.month} ${attr.cron.day_of_week}`;

          const nextRun = attr.next_run_at ? new Date(attr.next_run_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }) : 'N/A';

          embed.addFields({
            name: `${icon} ${attr.name}`,
            value: `\`\`\`yml\nTrigger: ${cron}\nStatus: ${status}\nTasks: ${attr.tasks?.length || 0} routines\nNext: ${nextRun}\nID: ${attr.id}\n\`\`\``,
            inline: true
          });
        });

        return embed;
      });

      await createPaginatedEmbed(interaction, embeds, { ephemeral: true });
    } catch (err) {
      const errorEmbed = handleApiError(err, 'Automation Logistics', 'audit schedules', { serverId: interaction.options.getString('id') });
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
