const { sequelize, User, Restaurant, Comment, Favorite, Like, Followship } = require('../../models')
const { imgurFileHandler } = require('../../helpers/file-helpers')
const userServices = require('../../services/user-services')

const userController = {
  signUpPage: (req, res) => {
    res.render('signup')
  },
  signUp: (req, res, next) => {
    userServices.signUp(req, (err, data) => {
      if (err) next(err)
      req.flash('success_messages', '成功註冊帳號！')
      res.redirect('/signin')
    })
  },
  signInPage: (req, res) => {
    res.render('signin')
  },
  signIn: (req, res) => {
    req.flash('success_messages', '成功登入！')
    res.redirect('/restaurants')
  },
  logout: (req, res) => {
    req.flash('success_messages', '登出成功！')
    req.logout()
    res.redirect('/signin')
  },
  getUser: async (req, res, next) => {
    return Promise
      .all([
        Comment.findAll({
          include: [
            'User',
            'Restaurant'
          ],
          where: {
            userId: req.params.id
          },
          attributes: ['restaurantId'],
          group: ['restaurantId'],
          nest: true,
          raw: true
        }),
        User.findByPk(req.params.id),
        // query followings
        sequelize.query('SELECT `A`.`id`, `A`.`name`,`A`.`image` FROM users A WHERE`A`.`id` IN(SELECT `followships`.`following_id` FROM users B LEFT JOIN followships ON`B`.`id` = `followships`.`follower_id` WHERE`B`.`id` = ' + req.params.id + ') ORDER BY`A`.`id`;'),
        // query followers
        sequelize.query('SELECT `A`.`id`, `A`.`name`,`A`.`image` FROM users A WHERE`A`.`id` IN(SELECT `followships`.`follower_id` FROM users B LEFT JOIN followships ON`B`.`id` = `followships`.`following_id` WHERE`B`.`id` = ' + req.params.id + ') ORDER BY`A`.`id`;'),
        // query favoritedRestaurants
        sequelize.query('SELECT `restaurants`.`id`, `restaurants`.`image` FROM restaurants WHERE`restaurants`.`id` IN(SELECT `favorites`.`restaurant_id` FROM favorites WHERE`favorites`.`user_id` = ' + req.params.id + ') ORDER BY`restaurants`.`id`;')
      ])
      .then(([comments, user, [followings], [followers], [favoritedRestaurants]]) => {
        if (!user) throw new Error('User does not exist')
        res.render('users/profile', {
          checkedUser: user.toJSON(),
          restaurants: comments.map(item => item.Restaurant),
          followers,
          followings,
          favoritedRestaurants
        })
      })
      .catch(err => next(err))
  },
  editUser: (req, res, next) => {
    // if (Number(req.params.id) !== Number(req.user.id)) throw Error('User could only access their own profile')
    return User.findByPk(req.params.id)
      .then(user => {
        if (!user) throw new Error('User does not exist')
        res.render('users/edit', { user: user.toJSON() })
      })
      .catch(err => next(err))
  },
  putUser: (req, res, next) => {
    // if (Number(req.params.id) !== Number(req.user.id)) throw Error('User cannot edit other\'s profile')
    const { name } = req.body
    if (!name) throw Error('User name is required!')
    const { file } = req
    return Promise
      .all([
        User.findByPk(req.params.id),
        imgurFileHandler(file)
      ])
      .then(([user, filePath]) => {
        if (!user) throw Error('User does not exist')
        return user.update({
          name,
          image: filePath || user.image
        })
      })
      .then(() => {
        req.flash('success_messages', '使用者資料編輯成功')
        res.redirect(`/users/${req.params.id}`)
      })
      .catch(err => next(err))
  },
  addFavorite: (req, res, next) => {
    const { restaurantId } = req.params
    return Promise.all([
      Restaurant.findByPk(restaurantId),
      Favorite.findOne({
        where: {
          userId: req.user.id,
          restaurantId
        }
      })
    ])
      .then(([restaurant, favorite]) => {
        if (!restaurant) throw new Error("Restaurant didn't exist!")
        if (favorite) throw new Error('You have favorited this restaurant!')

        return Favorite.create({
          userId: req.user.id,
          restaurantId
        })
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  },
  removeFavorite: (req, res, next) => {
    return Favorite.findOne({
      where: {
        userId: req.user.id,
        restaurantId: req.params.restaurantId
      }
    })
      .then(favorite => {
        if (!favorite) throw new Error("You haven't favorited this restaurant")

        return favorite.destroy()
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  },
  addLike: (req, res, next) => {
    const userId = req.user.id
    const { restaurantId } = req.params

    return Promise
      .all([
        Restaurant.findByPk(restaurantId),
        Like.findOne({
          where: {
            userId,
            restaurantId
          }
        })
      ])
      .then(([restaurant, like]) => {
        if (!restaurant) throw new Error('restaurant does not exist')
        if (like) throw new Error('You have liked this restaurant')
        return Like.create({
          userId,
          restaurantId
        })
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  },
  removeLike: (req, res, next) => {
    const userId = req.user.id
    const { restaurantId } = req.params
    return Like
      .findOne({
        where: {
          userId,
          restaurantId
        }
      })
      .then(like => {
        if (!like) throw new Error('You haven\'t like this restaurant')
        return like.destroy()
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  },
  getTopUsers: (req, res, next) => {
    return User.findAll({
      include: [{ model: User, as: 'Followers' }]
    })
      .then(users => {
        users = users.map(user => ({
          ...user.toJSON(),
          followerCount: user.Followers.length,
          isFollowed: req.user.Followings.some(f => f.id === user.id)
        })).sort((a, b) => b.followerCount - a.followerCount)
        res.render('top-users', { users: users })
      })
      .catch(err => next(err))
  },
  addFollowing: (req, res, next) => {
    const { userId } = req.params
    if (Number(userId) === Number(req.user.id)) throw new Error('cannot follow yourself!')
    Promise.all([
      User.findByPk(userId),
      Followship.findOne({
        where: {
          followerId: req.user.id,
          followingId: userId
        }
      })
    ])
      .then(([user, followship]) => {
        if (!user) throw new Error("User didn't exist!")
        if (followship) throw new Error('You are already following this user!')
        return Followship.create({
          followerId: req.user.id,
          followingId: userId
        })
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  },
  removeFollowing: (req, res, next) => {
    Followship.findOne({
      where: {
        followerId: req.user.id,
        followingId: req.params.userId
      }
    })
      .then(followship => {
        if (!followship) throw new Error("You haven't followed this user!")
        return followship.destroy()
      })
      .then(() => res.redirect('back'))
      .catch(err => next(err))
  }
}

module.exports = userController
