from huggingface_hub import snapshot_download

snapshot_download(
    repo_id="amitpant7/Nepali-Automatic-Speech-Recognition",
    local_dir="nepali_asr_model"
)