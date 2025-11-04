# 读取package.json获取版本号

version=$(jq -r '.version' ../package.json)

# 执行update_version.sh更新版本号

# 拆分版本号 (major.minor.patch)
IFS='.' read -r major minor patch <<< "$version"

# 小版本号 +1
patch=$((patch + 1))

# 生成新版本号
new_version="${major}.${minor}.${patch}"
echo "更新版本号为: $new_version"

sh bash-scripts/update_version.sh "$new_version"

git add . && git commit -m "update version to: $new_version"

git push && git tag "v${new_version}" && git push origin "v${new_version}"

echo "发布完成"