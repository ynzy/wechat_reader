<template>
  <div class="app-container">
    <div class="filter-container">
      <!-- @blur="handleFilter" -->
      <el-input
        v-model="listQuery.title"
        clearable
        placeholder="书名"
        style="width: 200px;"
        class="filter-item"
        @keyup.enter.native="handleFilter"
        @clear="handleFilter"
        @blur="handleFilter"
      />
      <el-input
        v-model="listQuery.author"
        clearable
        placeholder="作者"
        style="width: 200px;"
        class="filter-item"
        @keyup.enter.native="handleFilter"
        @clear="handleFilter"
        @blur="handleFilter"
      />
      <el-select v-model="listQuery.category" placeholder="分类" clearable class="filter-item" @change="handleFilter">
        <el-option v-for="item in categoryList" :key="item.value" :label="item.label" :value="item.label" />
      </el-select>
      <el-button
        v-waves
        class="filter-item"
        type="primary"
        icon="el-icon-search"
        style="margin-left: 10px"
        @click="forceRefresh"
      >
        查询
      </el-button>
      <el-button class="filter-item" type="primary" icon="el-icon-edit" style="margin-left: 5px" @click="handleCreate">
        新增
      </el-button>
      <el-checkbox v-model="showCover" class="filter-item" style="margin-left:5px;" @change="changeShowCover">
        显示封面
      </el-checkbox>
    </div>
    <el-table
      :key="tableKey"
      v-loading="listLoading"
      :data="list"
      border
      fit
      highlight-current-row
      style="width: 100%;"
      :defalut-sort="defalutSort"
      @sort-change="sortChange"
    >
      <el-table-column
        label="ID"
        prop="id"
        sortable="custom"
        align="center"
        width="80"
        :class-name="getSortClass('id')"
      />
      <el-table-column label="书名" width="150" align="center">
        <template slot-scope="{ row: { titleWrapper } }">
          <span v-html="titleWrapper" />
        </template>
      </el-table-column>
      <el-table-column label="作者" width="150" align="center">
        <template slot-scope="{ row: { authorWrapper } }">
          <span v-html="authorWrapper" />
        </template>
      </el-table-column>
      <el-table-column label="出版社" prop="publisher" width="150" align="center" />
      <el-table-column label="分类" prop="categoryText" width="100" align="center" />
      <el-table-column label="语言" prop="language" align="center" />
      <el-table-column v-if="showCover" label="封面图片" width="150" align="center">
        <template slot-scope="scope">
          <a :href="scope.row.cover" target="_blank">
            <img :src="scope.row.cover" style="width:120px;height:180px" />
          </a>
        </template>
      </el-table-column>
      <el-table-column label="文件名" prop="fileName" width="100" align="center" />
      <el-table-column label="文件路径" width="100" align="center">
        <template slot-scope="{ row: { filePath } }">
          <span>{{ filePath | valueFilter }}</span>
        </template>
      </el-table-column>
      <el-table-column label="封面路径" width="100" align="center">
        <template slot-scope="{ row: { coverPath } }">
          <span>{{ coverPath | valueFilter }}</span>
        </template>
      </el-table-column>
      <el-table-column label="解压路径" width="100" align="center">
        <template slot-scope="{ row: { unzipPath } }">
          <span>{{ unzipPath | valueFilter }}</span>
        </template>
      </el-table-column>
      <el-table-column label="上传人" width="100" align="center">
        <template slot-scope="scope">
          <span>{{ scope.row.createUser | valueFilter }}</span>
        </template>
      </el-table-column>
      <el-table-column label="上传时间" width="100" align="center">
        <template slot-scope="scope">
          <span>{{ scope.row.createDt | timeFilter }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="120" fixed="right">
        <template slot-scope="{ row }">
          <PreviewDialog title="电子书信息" :data="row">
            <el-button type="text" icon="el-icon-view" />
          </PreviewDialog>
          <el-button type="text" icon="el-icon-edit" @click="handleUpdate(row)" />
          <el-button type="text" icon="el-icon-delete" style="color:#f56c6c" @click="handleDelete(row)" />
        </template>
      </el-table-column>
    </el-table>
    <pagination
      v-show="total > 0"
      :total="total"
      :page.sync="listQuery.page"
      :limit.sync="listQuery.pageSize"
      @pagination="refresh"
    />
  </div>
</template>

<script>
import { listBook, getCategory, deleteBook } from '@/api/book'
import { parseTime } from '@/utils'
import waves from '@/directive/waves'
import Pagination from '@/components/Pagination'
import PreviewDialog from './components/PreviewDialog'

export default {
  components: { Pagination, PreviewDialog },
  directives: { waves },
  filters: {
    timeFilter(time) {
      if (time) {
        return parseTime(time, '{y}-{m}-{d} {h}:{i}')
      } else {
        return '无'
      }
    },
    valueFilter(value) {
      if (value) {
        return value
      } else {
        return '无'
      }
    }
  },
  data() {
    return {
      tableKey: 0,
      list: null,
      total: 0,
      listLoading: false,
      downloadLoading: false,
      listQuery: {},
      showCover: true,
      categoryList: [],
      defalutSort: []
    }
  },
  created() {
    this.parseQuery()
  },
  mounted() {
    this.getList()
    this.getCategoryList()
  },
  beforeRouteUpdate(to, from, next) {
    // 对比路由参数，刷新页面
    if (to.path === from.path) {
      const newQuery = Object.assign({}, to.query)
      const oldQuery = Object.assign({}, from.query)
      if (JSON.stringify(newQuery) !== JSON.stringify(oldQuery)) {
        this.getList()
      }
    }
    next()
  },
  methods: {
    // 匹配搜索条件高亮
    wrapperKeyword(k, v) {
      function highlight(value) {
        return '<span style="color: #1890ff">' + value + '</span>'
      }
      if (!this.listQuery[k]) {
        return v
      } else {
        return v.replace(new RegExp(this.listQuery[k], 'ig'), v => highlight(v))
      }
    },
    // 收集查询条件
    parseQuery() {
      const query = Object.assign({}, this.$route.query)
      let sort = '+id'
      let listQuery = {
        page: 1,
        pageSize: 20,
        sort: '-id'
      }
      if (query) {
        query.page && (query.page = Number(query.page))
        query.pageSize && (query.pageSize = Number(query.pageSize))
        query.sort && (sort = query.sort)

        listQuery = Object.assign({}, query, listQuery)
      }
      const sortSymbol = sort[0]
      const sortColumn = sort.slice(1, sort.length)
      this.defalutSort = {
        prop: sortColumn,
        order: sortSymbol === '+' ? 'ascending' : 'descending'
      }
      this.listQuery = listQuery
    },
    refresh() {
      this.$router.replace({
        path: '/book/list',
        query: this.listQuery
      })
      // this.getList()
    },
    getCategoryList() {
      getCategory().then(response => {
        this.categoryList = response.data.filter(item => item.label)
      })
    },
    getList() {
      this.listLoading = true
      listBook(this.listQuery).then(response => {
        const { data, total } = response
        this.list = data
        this.total = total
        this.listLoading = false
        // console.log(this.list.length)
        this.list.forEach(book => {
          book.titleWrapper = this.wrapperKeyword('title', book.title)
          book.authorWrapper = this.wrapperKeyword('author', book.author)
        })
        // console.log(this.list.length)
      })
    },
    handleDelete(row) {
      this.$confirm('此操作将永久删除该电子书, 是否继续?', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        deleteBook({ fileName: row.fileName }).then(response => {
          this.$notify({
            title: '成功',
            message: response.msg || '删除成功',
            type: 'success',
            duration: 2000
          })
          // this.handleFilter()
          this.getList()
        })
      })
    },
    handleFilter() {
      this.list = []
      this.listQuery.page = 1
      this.refresh()
    },
    forceRefresh() {
      window.location.reload()
    },
    changeShowCover(value) {
      this.showCover = value
    },
    sortChange(data) {
      const { prop, order } = data
      this.sortBy(prop, order)
    },
    sortBy(prop, order) {
      if (order === 'ascending') {
        this.listQuery.sort = `+${prop}`
      } else {
        this.listQuery.sort = `-${prop}`
      }
      this.handleFilter()
    },
    getSortClass: function(key) {
      const sort = this.listQuery.sort
      return sort === `+${key}` ? 'ascending' : sort === `-${key}` ? 'descending' : ''
    },
    handleCreate() {
      this.$router.push('/book/create')
    },
    handleUpdate(row) {
      this.$router.push(`/book/edit/${row.fileName}`)
    }
  }
}
</script>

<style lang="scss" scoped></style>
