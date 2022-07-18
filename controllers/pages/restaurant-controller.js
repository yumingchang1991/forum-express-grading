const { Sequelize, sequelize, Restaurant, Category, Comment, User } = require('../../models')
const restaurantServices = require('../../services/restaurant-services')
const restaurantController = {
  getRestaurants: (req, res, next) => restaurantServices.getRestaurants(req, (err, data) => err ? next(err) : res.render('restaurants', data)),
  getRestaurant: (req, res, next) => {
    return Restaurant.findByPk(req.params.id, {
      include: [
        Category,
        { model: Comment, include: User },
        { model: User, as: 'FavoritedUsers' },
        { model: User, as: 'LikedUsers' }
      ],
      nest: true
    })
      .then(async restaurant => {
        if (!restaurant) throw new Error("Restaurant didn't exist!")
        const isFavorited = restaurant.FavoritedUsers.some(f => f.id === req.user.id)
        const isLiked = restaurant.LikedUsers.some(likedUser => likedUser.id === req.user.id)
        await restaurant.increment('view_counts')
        return res.render('restaurant', {
          restaurant: restaurant.toJSON(),
          isFavorited,
          isLiked
        })
      })
      .catch(err => next(err))
  },
  getDashboard: (req, res, next) => {
    return Restaurant.findByPk(req.params.id, {
      include: [
        Category,
        Comment
      ],
      nest: true
    })
      .then(restaurant => {
        if (!restaurant) throw new Error("Restaurant didn't exist!")
        res.render('dashboard', { restaurant: restaurant.toJSON() })
      })
  },
  getFeeds: (req, res, next) => {
    return Promise.all([
      Restaurant.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [Category],
        raw: true,
        nest: true
      }),
      Comment.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [User, Restaurant],
        raw: true,
        nest: true
      })
    ])
      .then(([restaurants, comments]) => {
        res.render('feeds', {
          restaurants,
          comments
        })
      })
      .catch(err => next(err))
  },
  getTopRestaurants: async (req, res, next) => {
    // query TOP 10 favorited restaurants from database
    const [results, metadata] = await sequelize.query('SELECT `restaurants`.`id`, `restaurants`.`name`, `restaurants`.`image`, substring(`restaurants`.`description`, 1, 60) AS`description`, COUNT(`favorites`.`user_id`) as `favoritedCount`FROM restaurants LEFT JOIN favorites on restaurants.id = favorites.restaurant_id GROUP BY `restaurants`.`id` ORDER BY `favoritedCount` DESC LIMIT 10;')

    const favoritedRestaurantsId = req.user && req.user.FavoritedRestaurants.map(fr => fr.id)

    const restaurants = results.map(r => ({
      ...r,
      isFavorited: favoritedRestaurantsId ? favoritedRestaurantsId.includes(r.id) : false
    }))

    res.render('top-restaurants', { restaurants })

    // return Restaurant
    //   .findAll({
    //     include: [{ model: User, as: 'FavoritedUsers' }],
    //     // attributes: {
    //     //   include: [[
    //     //     Sequelize.fn('COUNT', Sequelize.col('FavoritedUsers.id')),
    //     //     'favoritedCount'
    //     //   ]]
    //     // },
    //     // group: ['Restaurant.id'],
    //     // order: [
    //     //   [Sequelize.literal('favoritedCount'), 'DESC']
    //     // ],
    //     nest: true
    //   })
    //   .then(restaurants => {
    //     const LIMIT = 10
    //     const favoritedRestaurantsId = req.user && req.user.FavoritedRestaurants.map(fr => fr.id)
    //     const restaurantsNormalized = restaurants.map(r => {
    //       const rJSON = r.toJSON()
    //       const rNormalized = {
    //         ...rJSON,
    //         description: rJSON.description.substring(0, 60),
    //         favoritedCount: rJSON.FavoritedUsers.length,
    //         isFavorited: favoritedRestaurantsId ? favoritedRestaurantsId.includes(rJSON.id) : false
    //       }
    //       return rNormalized
    //     })
    //       .sort((pre, next) => (next.favoritedCount - pre.favoritedCount))
    //       .slice(0, LIMIT)

    //     res.render('top-restaurants', { restaurants: restaurantsNormalized })
    //   })
    //   .catch(err => next(err))
  }
}

module.exports = restaurantController
