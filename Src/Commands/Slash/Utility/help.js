const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

module.exports = {
    name: "help",
    description: "Access the comprehensive operative command manual.",
    category: "Utility",
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Access the comprehensive operative command manual."),

    async execute(client, interaction) {
        const categories = {
            panel: {
                label: 'Panel Gateways',
                emoji: '🔧',
                description: 'Manage your Pterodactyl panel connections.',
                commands: '`/panel view list` - View saved panels\n`/panel view info` - Connection details\n`/panel control add` - Add new panel\n`/panel control edit` - Update credentials\n`/panel control rename` - Rebrand panel\n`/panel control remove` - Decommission panel'
            },
            server: {
                label: 'Instance Intelligence',
                emoji: '🖥️',
                description: 'Advanced monitoring and live dashboarding.',
                commands: '`/server view list` - Interactive Dashboard\n`/server view info` - Technical specs\n`/server view status` - Quick heartbeat\n`/server view resources` - Live performance\n`/server view summary` - Cluster overview'
            },
            control: {
                label: 'Operational Control',
                emoji: '⚡',
                description: 'Direct environmental manipulation.',
                commands: '`/server control start/stop/restart` - Power\n`/server control kill` - Emergency halt\n`/server control console` - Remote terminal\n`/server control activity` - Security audit'
            },
            manage: {
                label: 'Ecosystem Management',
                emoji: '⚙️',
                description: 'Configure and automate your server state.',
                commands: '`/server manage rename` - Rebrand instance\n`/server manage reinstall` - Reset environment\n`/server manage variables` - Env audit\n`/server manage variable-update` - Set vars\n`/server network allocations` - Port audit\n`/server automation schedules` - Task engine'
            },
            storage: {
                label: 'Storage & Identity',
                emoji: '💾',
                description: 'Backups, Databases, Users, and Files.',
                commands: '`/backup list` - View snapshots\n`/backup actions <cmd>` - Manage snapshots\n`/database list` - View databases\n`/database actions <cmd>` - Manage databases\n`/user list` - View subusers\n`/user actions <cmd>` - Manage access\n`/files view list/content` - File explorer'
            },
            utility: {
                label: 'System Telemetry',
                emoji: '🛠️',
                description: 'Bot status and diagnostic tools.',
                commands: '`/utility bot ping` - Check system latency\n`/utility help` - Show this operative menu'
            }
        };

        const generateHelpEmbed = (categoryKey = 'main') => {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTimestamp();

            if (categoryKey === 'main') {
                embed.setTitle('🚀 Pterodactyl Bot — Professional Management')
                    .setDescription('Welcome to the next generation of Discord Pterodactyl integration. Use the dropdown below to explore specific categories.')
                    .addFields(
                        { name: '✨ Features', value: '• Real-time server monitoring\n• Interactive power controls\n• Multi-panel support\n• End-to-end management', inline: false },
                        { name: '📊 Statistics', value: `\`${Object.keys(categories).reduce((acc, curr) => acc + categories[curr].commands.split('\n').length, 0)}\` Commands available\nDashboard enabled`, inline: true },
                        { name: '🛡️ Security', value: 'User API Key only\nNo Admin access\nEncrypted storage', inline: true }
                    )
                    .setFooter({ text: 'Select a category to see detailed commands' });
            } else {
                const cat = categories[categoryKey];
                embed.setTitle(`${cat.emoji} ${cat.label}`)
                    .setDescription(cat.description)
                    .addFields({ name: 'Commands', value: cat.commands });
            }

            return embed;
        };

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('Select a category...')
            .addOptions([
                { label: 'Overview', value: 'main', emoji: '🏠' },
                ...Object.keys(categories).map(key => ({
                    label: categories[key].label,
                    value: key,
                    emoji: categories[key].emoji,
                    description: categories[key].description
                }))
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const initialEmbed = generateHelpEmbed('main');

        const msg = await interaction.reply({
            embeds: [initialEmbed],
            components: [row],
            ephemeral: true,
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 300000
        });

        collector.on('collect', async i => {
            await i.update({ embeds: [generateHelpEmbed(i.values[0])] });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => { });
        });
    }
};
