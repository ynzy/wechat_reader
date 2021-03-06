const _ = require('lodash')
const { insert, queryOne } = require('../db')
const Book = require('../models/Book')
const db = require('../db')
const { reject } = require('lodash')
const { debug } = require('../utils/constant')

// 判断是否存在此电子书
function exists(book) {
  const { title, author, publisher } = book
  console.log(title, author, publisher);
  const sql = `select * from book where title='${title}' and author='${author}' and publisher='${publisher}'`
  return queryOne(sql)
}

// 移除电子书
async function removeBook(book) {
  if (book) {
    // 删除保存的电子书文件数据
    book.reset()
    // 删除数据库中电子书数据
    if (book.fileName) {
      const removeBookSql = `delete from book where fileName='${book.fileName}'`
      const removeContentsSql = `delete from contents where fileName='${book.fileName}'`
      await db.querySql(removeBookSql)
      await db.querySql(removeContentsSql)
    }
  }
}
async function insertContents(book) {
  let contents = book.getContents()
  if (!contents) {
    const newBook = await book.parse()
    contents = newBook.getContents()
  }
  if (contents && contents.length > 0) {
    for (let i = 0; i < contents.length; i++) {
      let content = contents[i]
      const _content = _.pick(content, [
        'fileName',
        'id',
        'href',
        'order',
        'level',
        'text',
        'label',
        'pid',
        'navId'
      ])
      await insert(_content, 'contents')
    }
  }
}

function insertBook(book) {
  return new Promise(async (resolve, reject) => {
    try {
      if (book instanceof Book) {
        const result = await exists(book)
        // 如果有此电子书把它移除掉
        if (result) {
          await removeBook(book)
          reject(new Error('电子书已存在'))
        } else {
          // console.log('添加电子书');
          await insert(book.toDb(), 'book')
          await insertContents(book)
          resolve()
        }
      } else {
        reject(new Error('添加的图书对象不合法'))
      }
    } catch (e) {
      reject(e)
    }
  })
}

function updateBook(book) {
  return new Promise(async (resolve, reject) => {
    try {
      if (book instanceof Book) {
        const result = await getBook(book.fileName)
        // console.log(result);
        if (result) {
          const model = book.toDb()
          if (+result.updateType === 0) {
            reject(new Error('内置图书不能编辑'))
          } else {
            delete model.createDt // 创建时间不能更新
            if (result.createUser !== book.createUser) {
              reject(new Error('只有创建人才能编辑'))
            } else {
              await db.update(model, 'book', `where fileName='${book.fileName}'`)
              resolve()
            }
          }
        }
      }
    } catch (e) {
      reject(e)
    }
  })
}
// 获取图书
function getBook(fileName) {
  return new Promise(async (resolve, reject) => {
    const bookSql = `select * from book where fileName='${fileName}'`
    const contentsSql = `select * from contents where fileName='${fileName}' order by \`order\``
    const book = await db.queryOne(bookSql)
    const contents = await db.querySql(contentsSql)
    if (book) {
      book.cover = Book.genCoverUrl(book)
      book.contentsTree = Book.genContentsTree(contents)
      resolve(book)
    } else {
      reject(new Error('电子书不存在'))
    }
  })
}
// 获取分类
async function getCategory() {
  const sql = 'select * from category order by category asc'
  const result = await db.querySql(sql)
  const categoryList = []
  result.forEach(item => {
    categoryList.push({
      label: item.categoryText,
      value: item.category,
      num: item.num
    })
  })
  return categoryList
}
// 图书列表
async function listBook(query) {
  debug && console.log(query);
  const { page = 1,
    pageSize = 20,
    sort,
    title,
    category,
    author } = query
  const offset = (page - 1) * pageSize;
  let bookSql = 'select * from book'
  let where = 'where'
  // 查询关键字
  title && (where = db.andLike(where, 'title', title))
  author && (where = db.andLike(where, 'author', author))
  category && (where = db.and(where, 'categoryText', category))
  if (where !== 'where') {
    bookSql = `${bookSql} ${where}`
  }
  // 查询排序
  if (sort) {
    const symbol = sort[0]
    const column = sort.slice(1, sort.length)
    const order = symbol === '+' ? 'asc' : 'desc'
    bookSql = `${bookSql} order by ${column} ${order}`
  }
  // 查询分页
  bookSql = `${bookSql} limit ${pageSize} offset ${offset}`
  // 查询总数
  let countSql = `select count(*) as count from book`
  if (where !== 'where') {
    countSql = `${countSql} ${where}`
  }
  debug && console.log('bookSql:', bookSql)
  debug && console.log('countSql:', countSql)
  const list = await db.querySql(bookSql)
  list.forEach(book => book.cover = Book.genCoverUrl(book))
  const count = await db.querySql(countSql)
  console.log(list.length);
  return { list, count: count[0].count, page, pageSize }
}
// 删除图书
function deleteBook({ fileName }) {
  return new Promise(async (resolve, reject) => {
    let book = await getBook(fileName)
    if (book) {
      if (+book.updateType === 0) {
        reject(new Error('内置电子书不能删除'))
      } else {
        const bookObj = new Book(null, book)
        const sql = `delete from book where fileName='${fileName}'`
        db.querySql(sql).then(() => {
          bookObj.reset()
          resolve()
        }).catch(err => {
          reject(new Error(err))
        })
      }
    } else {
      reject(new Error('电子书不存在'))
    }

  })
}


module.exports = {
  insertBook,
  getBook,
  updateBook,
  getCategory,
  listBook,
  deleteBook
}