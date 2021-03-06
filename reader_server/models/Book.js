/**
 * file 电子书文件（上传）
 * data 电子书数据（编辑）
 */
const fs = require('fs')
const path = require('path')
const Epub = require('../utils/epub')
const { MIME_TYPE_EPUB, UPLOAD_URL, UPLOAD_PATH, UPDATE_TYPE_FROM_WEB, OLD_UPLOAD_URL } = require('../utils/constant')
const xml2js = require('xml2js').parseString
class Book {
  constructor(file, data) {
    if (file) {
      this.createBookFromFile(file)
    } else {
      this.createBookFromData(data)
    }
  }
  // 新增电子书
  createBookFromFile(file) {
    // console.log(file);
    const {
      destination, filename, mimetype = MIME_TYPE_EPUB, path, originalname
    } = file
    let reg = /^application\/epub\+zip|application\/epub$/
    //* 电子书的文件后缀名
    const suffix = reg.test(mimetype) ? '.epub' : ''
    //* 电子书的原有路径
    const oldBookPath = path
    //* 电子书的新路径
    const bookPath = `${destination}/${filename}${suffix}`
    //* 电子书的下载url
    const url = `${UPLOAD_URL}/book/${filename}${suffix}`
    //* 电子书解压后的文件夹路径
    const unzipPath = `${UPLOAD_PATH}/unzip/${filename}`
    //* 电子书解压后的文件夹URL
    const unzipUrl = `${UPLOAD_URL}/unzip/${filename}`
    //* 如果没有电子书的解压路径
    if (!fs.existsSync(unzipPath)) {
      // 创建目录
      fs.mkdirSync(unzipPath, { recursive: true })
    }
    //* 如果有解压路径 并且 不存在新的路径，重命名 
    if (fs.existsSync(unzipPath) && !fs.existsSync(bookPath)) {
      fs.renameSync(oldBookPath, bookPath)
    }
    this.fileName = filename
    this.path = `/book/${filename}${suffix}` // epub文件相对路径
    this.filePath = this.path
    this.unzipPath = `/unzip/${filename}` // epub解压后相对路径
    this.url = url // epub文件下载链接
    this.title = '' // 书名
    this.author = '' // 作者
    this.publisher = '' // 出版社
    this.contents = [] // 目录
    this.cover = '' // 封面图片URL
    this.coverPath = '' // 封面图片路径
    this.category = -1 // 分类ID
    this.categoryText = '' // 分类名称
    this.language = '' // 语种
    this.unzipUrl = unzipUrl // 解压后文件夹链接(阅读电子书需要)
    this.originalName = originalname // 电子书文件的原名
  }

  createBookFromData(data) {
    // console.log(data);
    this.fileName = data.fileName
    this.cover = data.coverPath
    this.title = data.title
    this.author = data.author
    this.publisher = data.publisher
    this.bookId = data.fileName
    this.language = data.language
    this.rootFile = data.rootFile
    this.originalName = data.originalName
    this.path = data.path || data.filePath
    this.filePath = data.path || data.filePath
    this.unzipPath = data.unzipPath
    this.coverPath = data.coverPath
    this.createUser = data.username
    this.createDt = new Date().getTime()
    this.updateDt = new Date().getTime()
    this.updateType = data.updateType === 0 ? data.updateType : UPDATE_TYPE_FROM_WEB
    this.contents = data.contents
    this.category = data.category || 99
    this.categoryText = data.categoryText || '自定义'
  }
  // 解析电子书路径
  parse() {
    return new Promise((resolve, reject) => {
      const bookPath = `${UPLOAD_PATH}${this.filePath}`
      // console.log(bookPath);
      if (!fs.existsSync(bookPath)) {
        reject(new Error('电子书不存在'))
      }
      const epub = new Epub(bookPath)
      epub.on('error', err => {
        reject(err)
      })
      epub.on('end', err => {
        if (err) {
          reject(err)
        } else {
          // console.log(epub.manifest);
          const { language, creator, creatorFileAs, title, cover, publisher } = epub.metadata
          if (!title) {
            reject(new Error('图书标题为空'))
          } else {
            this.title = title
            this.language = language || 'en'
            this.author = creator || creatorFileAs || 'unknown'
            this.publisher = publisher || 'unknown'
            this.rootFile = epub.rootFile
            const handleGetImage = (err, file, mimeType) => {
              if (err) {
                reject(err)
              } else {
                const suffix = mimeType.split('/')[1]
                const coverPath = `${UPLOAD_PATH}/img/${this.fileName}.${suffix}`
                const coverUrl = `${UPLOAD_URL}/img/${this.fileName}.${suffix}`
                fs.writeFileSync(coverPath, file, 'binary')
                this.coverPath = `/img/${this.fileName}.${suffix}`
                this.cover = coverUrl
                resolve(this)
              }
            }
            try {
              this.unzip()
              this.parseContents(epub).then(({ chapters, chapterTree }) => {
                // console.log(chapters);
                this.contents = chapters
                this.contentsTree = chapterTree
                epub.getImage(cover, handleGetImage)
              })
            } catch (e) {
              reject(e)
            }
          }
        }
      })
      epub.parse()
    })
  }
  // 解压电子书
  unzip() {
    const AdmZip = require('adm-zip')
    const zip = new AdmZip(Book.genPath(this.path))
    zip.extractAllTo(Book.genPath(this.unzipPath), true)
  }
  // 解析目录
  parseContents(epub) {
    // 获取目录文件
    // D:/A_Personal/epub/admin-upload-ebook/unzip/e8cf03d70942d841ae9d0b0d93f69e20/OEBPS/toc.ncx
    function getNcxFilePath() {
      const spine = epub && epub.spine
      const manifest = epub && epub.manifest
      const ncx = spine.toc && spine.toc.href
      const id = spine.toc && spine.toc.id
      // console.log('spine', ncx, manifest[id].href);
      if (ncx) {
        return ncx
      } else {
        return manifest[id].href
      }
    }
    // 查找父级对象
    function findParent(array, level = 0, pid = '') {
      return array.map(item => {
        item.level = level
        item.pid = pid
        // 包含子目录
        if (item.navPoint && item.navPoint.length > 0) {
          item.navPoint = findParent(item.navPoint, level + 1, item['$'].id)
          // 如果navPoint是个对象
        } else if (item.navPoint) {
          item.navPoint.level = level + 1
          item.navPoint.pid = item['$'].id
        }
        return item
      })
    }
    // 展开多级数组
    function flatten(array) {
      return [].concat(...array.map(item => {
        if (item.navPoint && item.navPoint.length > 0) {
          return [].concat(item, ...flatten(item.navPoint))
        } else if (item.navPoint) {
          return [].concat(item, item.navPoint)
        }
        return item
      }))
    }
    const ncxFilePath = Book.genPath(`${this.unzipPath}/${getNcxFilePath()}`)
    // console.log(ncxFilePath);
    if (fs.existsSync(ncxFilePath)) {
      return new Promise((resolve, reject) => {
        const xml = fs.readFileSync(ncxFilePath, 'utf-8')
        // 路径有相对路径和绝对路径，替换掉绝对路径，都改成相对路径
        // dir D:/A_Personal/epub/admin-upload-ebook/unzip/528d54275940d8ff8b420b1685a2a8de/OEBPS
        // dir /epub/admin-upload-ebook/unzip/420d0ea28c955e655982ec729e4ea482/OEBPS
        const dir = path.dirname(ncxFilePath).replace(UPLOAD_PATH, '')
        // console.log('dir', dir);
        const fileName = this.fileName
        const unzipPath = this.unzipPath
        xml2js(xml, {
          explicitArray: false,
          ignoreAttrs: false
        },
          function (err, json) {
            if (err) {
              reject(err)
            } else {
              const navMap = json.ncx.navMap
              // console.log(JSON.stringify(navMap));
              // console.log('xml', navMap);
              if (navMap.navPoint && navMap.navPoint.length > 0) {
                // 修改结构
                navMap.navPoint = findParent(navMap.navPoint)
                // 数组扁平化
                const newNavMap = flatten(navMap.navPoint)
                const chapters = [] //目录信息
                // console.log(epub.flow);
                newNavMap.forEach((chapter, index) => {
                  const src = chapter.content['$'].src
                  chapter.id = `${src}`
                  chapter.href = `${dir}/${src}`.replace(unzipPath, '')
                  chapter.text = `${UPLOAD_URL}${dir}/${src}`
                  // console.log(chapter.text);
                  chapter.label = chapter.navLabel.text || ''
                  chapter.navId = chapter['$'].id
                  chapter.fileName = fileName
                  chapter.order = index + 1
                  // console.log(chapter);
                  chapters.push(chapter)
                })

                const chapterTree = Book.genContentsTree(chapters)
                // console.log(chapters);
                /* chapters.forEach(c => {
                  c.children = []
                  // 一级目录
                  if (c.pid === '') {
                    chapterTree.push(c)
                  } else {
                    const parent = chapters.find(_ => _.navId === c.pid)
                    parent.children.push(c)
                  }
                }) */
                // console.log(chapterTree);
                resolve({ chapters, chapterTree })
              } else {
                reject(new Error('目录解析失败，目录数为0'))
              }
            }
          })

      })
    } else {
      throw new Error('目录文件不存在')
    }

  }
  // 将book对象中与数据库相关的数据提取出来，供使用
  toDb() {
    return {
      fileName: this.fileName,
      cover: this.coverPath,
      title: this.title,
      author: this.author,
      publisher: this.publisher,
      bookId: this.fileName,
      language: this.language,
      rootFile: this.rootFile,
      originalName: this.originalName,
      filePath: this.filePath,
      unzipPath: this.unzipPath,
      coverPath: this.coverPath,
      createUser: this.createUser,
      createDt: this.createDt,
      updateDt: this.updateDt,
      updateType: this.updateType,
    }
  }
  // 获取电子书目录
  getContents() {
    return this.contents
  }
  // 删除电子书文件
  reset() {
    if (Book.pathExists(this.filePath)) {
      fs.unlinkSync(Book.genPath(this.filePath))
    }
    if (Book.pathExists(this.coverPath)) {
      fs.unlinkSync(Book.genPath(this.coverPath))
    }
    if (Book.pathExists(this.unzipPath)) {
      //! 低版本 node 中 recursive不支持
      fs.rmdirSync(Book.genPath(this.unzipPath), { recursive: true })
    }
  }
  // 生成路径
  static genPath(path) {
    // 如果没有/ 添加/
    if (!path.startsWith('/')) {
      path = `/${path}`
    }
    return `${UPLOAD_PATH}${path}`
  }
  // 判断路径是否存在
  static pathExists(path) {
    if (path.startsWith(UPLOAD_PATH)) {
      return fs.existsSync(path)
    } else {
      return fs.existsSync(Book.genPath(path))
    }
  }
  // 获取图书路径
  static genCoverUrl(book) {
    const { cover } = book
    // 新的电子书
    if (+book.updateType === 0) {
      if (!cover) return null;
      if (cover.startsWith('/')) {
        return `${OLD_UPLOAD_URL}${cover}`
      } else {
        return `${OLD_UPLOAD_URL}/${cover}`
      }
      // 老电子书
    } else {
      if (!cover) return null;
      if (cover.startsWith('/')) {
        return `${UPLOAD_URL}${cover}`
      } else {
        return `${UPLOAD_URL}/${cover}`
      }
    }
  }
  // 生成目录树
  static genContentsTree(contents) {
    if (!contents) return null
    const contentsTree = []
    contents.forEach(c => {
      c.children = []
      // 一级目录
      if (c.pid === '') {
        contentsTree.push(c)
      } else {
        const parent = contents.find(_ => _.navId === c.pid)
        parent.children.push(c)
      }
    })
    return contentsTree
  }
}

module.exports = Book