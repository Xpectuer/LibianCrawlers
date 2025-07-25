<script setup lang="ts">
import { ref, shallowRef, computed } from "vue";
import { useAsyncState } from "@vueuse/core";
import { useNodesStore } from "../stores/app";
import { useDialog } from 'naive-ui'

const dialog = useDialog()
const api = shallowRef(pywebview.api);
const { myIdentities, call_generate_new_identitiy } = useNodesStore();
const show_input_pri_key_password = ref(false)
const pri_key_password = ref('')

const pri_key_password_invalid_reason = computed(() => {
    if (pri_key_password.value.length < 12) {
        return '私钥加密保护密码必须至少12个字符'
    }
    return false
})
</script>

<template>
    <div id="identity-init" class="flex h-screen">
        <n-modal v-model:show="show_input_pri_key_password">
            <n-card style="width: 600px" title="设置私钥加密保护密码" :bordered="false" size="huge" role="dialog"
                aria-modal="true">
                <!-- <template #header-extra>
                    噢！
                </template> -->
                <div class="flex flex-col gap-4">
                    <p>为了保护私钥在文件系统的安全，我们需要您设置并记住此密码。此密码用于加密私钥文件。</p>
                    <n-input type="password" show-password-on="click" placeholder="私钥加密保护密码" clearable autofocus
                        :maxlength="36" :status="!pri_key_password_invalid_reason ? 'success' : 'warning'"
                        v-model:value="pri_key_password" />
                    <p v-if="pri_key_password_invalid_reason" class="text-red-500">{{ pri_key_password_invalid_reason }}
                    </p>
                    <n-button v-else type="primary"
                        @click="() => call_generate_new_identitiy(pri_key_password)">确定</n-button>
                </div>
                <!-- <template #footer>
                    尾部
                </template> -->
            </n-card>
        </n-modal>
        <div class="m-auto">
            <p>在启动之前，需要设置节点的身份。</p>
            <br />
            <ul class="flex flex-col items-center gap-4">
                <li>
                    <n-button @click="() => show_input_pri_key_password = true">生成新的非对称密钥对</n-button>
                </li>
                <li>
                    <n-upload>
                        <n-button>从文件系统导入非对称密钥对</n-button>
                    </n-upload>
                </li>
            </ul>
        </div>
    </div>
</template>

<style scoped></style>
