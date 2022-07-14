'use strict'
const { Restaurant, User } = require('../models')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return Promise.all([
      User
        .findAll({
          where: {
            [Sequelize.Op.or]: [
              { email: 'root@example.com' },
              { email: 'user1@example.com' },
              { email: 'user2@example.com' }
            ]
          },
          raw: true
        }),
      Restaurant.findAll({ raw: true })
    ])
      .then(async ([users, restaurants]) => {
        await queryInterface.bulkInsert('Favorites',
          Array.from({ length: 40 }, () => ({
            user_id: users[Math.floor(Math.random() * users.length)].id,
            restaurant_id: restaurants[Math.floor(Math.random() * restaurants.length)].id,
            created_at: new Date(),
            updated_at: new Date()
          }))
        )
      })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Favorites', {})
  }
}
