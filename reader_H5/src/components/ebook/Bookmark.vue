<template>
  <div class="ebook-bookmark-icon" :style="style" ref="bookmark"></div>
</template>

<script type="text/ecmascript-6">
import { px2rem } from '@/utils/utils'

export default {
  props: {
    width: Number,
    height: Number,
    color: String
  },
  computed: {
    style() {
      if(this.color){
        return {
          borderColor: `${this.color} ${this.color} transparent ${this.color}`
        }
      }else {
        return {}
      }
    }
  },
  methods: {
    refresh() {
      if (this.height && this.width && this.width > 0 && this.height > 10) {
        // 三角形高度为5px 左右边距为宽度的一半  上 右 下 左
        this.$refs.bookmark.style.borderWidth = `${px2rem(this.height - 5)}rem ${px2rem(this.width / 2)}rem ${px2rem(5)}rem ${px2rem(this.width / 2)}rem`
      }
    }
  },
  mounted() {
    this.refresh()
  }
}
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.ebook-bookmark-icon {
  width: 0;
  height: 0;
  font-weight: bold;
  line-height: 0;
  border-width: 50px 10px 10px 10px;
  border-style: solid;
  border-color: white white transparent white;
}
</style>
