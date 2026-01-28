const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ptero = require('../../../Functions/pteroService');
const pteroUtils = require('../../../Functions/pteroUtils');
const { handleApiError } = require('../../../Functions/errorHandler');

module.exports = {
  name: 'delete',
  description: 'Decommission a database cluster from the production net.',
  category: 'Database',
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Decommission a database cluster from the production net.')
    .addStringOption(opt => opt.setName('id').setDescription('Server ID').setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('database').setDescription('Database internal ID').setRequired(true)),

  async autocomplete(interaction) {
    await pteroUtils.serverAutocomplete(interaction);
  },

  async execute(client, interaction) {
    const resolved = await pteroUtils.resolveServer(interaction);
    if (!resolved) {
      return interaction.reply({ content: '❌ Server not found or panel connection failed.', ephemeral: true });
    }

    const { panel, serverId } = resolved;
    const databaseId = interaction.options.getString('database');

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🚨 Critical Table Purge requested')
      .setDescription(`You are about to decommission database \`${databaseId}\` on instance \`${serverId}\`.`)
      .addFields(
        { name: '⚠️ Risk Factor', value: '• All SQL tables and relations will be dropped.\n• Connected applications will lose database access.\n• **Operation is non-reversible.**', inline: false }
      )
      .setFooter({ text: 'Authorize the purge to proceed.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_db_delete')
        .setLabel('Confirm Decommission')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💣'),
      new ButtonBuilder()
        .setCustomId('cancel_db_delete')
        .setLabel('Abort Mission')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛡️')
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'confirm_db_delete') {
        await i.deferUpdate();
        try {
          await ptero.deleteDatabase(panel.url, panel.apikey, serverId, databaseId);

          const successEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ Database Decommissioned')
            .setDescription(`The SQL instance \`${databaseId}\` has been successfully erased from the node registry.`)
            .setTimestamp();

          await interaction.editReply({ embeds: [successEmbed], components: [] });
        } catch (err) {
          const error = handleApiError(err, 'Database Purge', 'execute relational decommission');
          await interaction.editReply({ embeds: [error], components: [] });
        }
      } else {
        await i.update({ content: '🛡️ **Decommission Aborted.** Database remains operational.', embeds: [], components: [] });
      }
      collector.stop();
    });
  }
};
